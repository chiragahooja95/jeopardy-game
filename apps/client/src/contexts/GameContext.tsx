import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type FinalJeopardyAnswerPhasePayload,
  type FinalJeopardyRevealPayload,
  type FinalJeopardyWagerPhasePayload,
  type GameOverPayload,
  type RoomConfig,
  type SerializedRoom,
  type ServerErrorPayload
} from "@jeopardy/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from "react";
import { useSocket } from "../hooks/useSocket";
import { useUserContext } from "./UserContext";

interface GameContextState {
  room: SerializedRoom | null;
  playerId: string | null;
  isInRoom: boolean;
  error: string | null;
  isConnected: boolean;
  finalJeopardyWagerPhase: FinalJeopardyWagerPhasePayload | null;
  finalJeopardyAnswerPhase: FinalJeopardyAnswerPhasePayload | null;
  finalJeopardyReveal: FinalJeopardyRevealPayload | null;
  gameOver: GameOverPayload | null;
  isRoomActionPending: boolean;
  roomAction: "creating" | "joining" | null;
  createRoom: (input: { userId: string; userName: string; config: RoomConfig }) => void;
  joinRoom: (input: { roomCode: string; userId: string; userName: string; asSpectator?: boolean }) => void;
  leaveRoom: () => void;
  startGame: () => void;
  selectQuestion: (questionId: string) => void;
  buzzIn: () => void;
  submitAnswer: (answer: string) => void;
  submitWager: (wager: number) => void;
  submitFinalWager: (wager: number) => void;
  submitFinalAnswer: (answer: string) => void;
  clearRoomActionPending: () => void;
  clearError: () => void;
}

interface State {
  room: SerializedRoom | null;
  playerId: string | null;
  error: string | null;
  finalJeopardyWagerPhase: FinalJeopardyWagerPhasePayload | null;
  finalJeopardyAnswerPhase: FinalJeopardyAnswerPhasePayload | null;
  finalJeopardyReveal: FinalJeopardyRevealPayload | null;
  gameOver: GameOverPayload | null;
  isRoomActionPending: boolean;
  roomAction: "creating" | "joining" | null;
}

type Action =
  | { type: "SET_ROOM"; room: SerializedRoom }
  | { type: "SET_PLAYER_ID"; playerId: string | null }
  | { type: "CLEAR_ROOM" }
  | { type: "SET_ERROR"; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_FINAL_WAGER_PHASE"; payload: FinalJeopardyWagerPhasePayload }
  | { type: "SET_FINAL_ANSWER_PHASE"; payload: FinalJeopardyAnswerPhasePayload }
  | { type: "SET_FINAL_REVEAL"; payload: FinalJeopardyRevealPayload }
  | { type: "CLEAR_FINAL_STATE" }
  | { type: "SET_GAME_OVER"; payload: GameOverPayload }
  | { type: "CLEAR_GAME_OVER" }
  | { type: "SET_ROOM_ACTION_PENDING"; roomAction: "creating" | "joining" }
  | { type: "CLEAR_ROOM_ACTION_PENDING" };

const initialState: State = {
  room: null,
  playerId: null,
  error: null,
  finalJeopardyWagerPhase: null,
  finalJeopardyAnswerPhase: null,
  finalJeopardyReveal: null,
  gameOver: null,
  isRoomActionPending: false,
  roomAction: null
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "SET_ROOM":
      return { ...state, room: action.room };
    case "SET_PLAYER_ID":
      return { ...state, playerId: action.playerId };
    case "CLEAR_ROOM":
      return {
        room: null,
        playerId: null,
        error: state.error,
        finalJeopardyWagerPhase: null,
        finalJeopardyAnswerPhase: null,
        finalJeopardyReveal: null,
        gameOver: null,
        isRoomActionPending: false,
        roomAction: null
      };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "SET_FINAL_WAGER_PHASE":
      return {
        ...state,
        finalJeopardyWagerPhase: action.payload,
        finalJeopardyAnswerPhase: null,
        finalJeopardyReveal: null
      };
    case "SET_FINAL_ANSWER_PHASE":
      return {
        ...state,
        finalJeopardyAnswerPhase: action.payload,
        finalJeopardyReveal: null
      };
    case "SET_FINAL_REVEAL":
      return {
        ...state,
        finalJeopardyReveal: action.payload
      };
    case "CLEAR_FINAL_STATE":
      return {
        ...state,
        finalJeopardyWagerPhase: null,
        finalJeopardyAnswerPhase: null,
        finalJeopardyReveal: null
      };
    case "SET_GAME_OVER":
      return {
        ...state,
        gameOver: action.payload
      };
    case "CLEAR_GAME_OVER":
      return {
        ...state,
        gameOver: null
      };
    case "SET_ROOM_ACTION_PENDING":
      return {
        ...state,
        isRoomActionPending: true,
        roomAction: action.roomAction
      };
    case "CLEAR_ROOM_ACTION_PENDING":
      return {
        ...state,
        isRoomActionPending: false,
        roomAction: null
      };
    default:
      return state;
  }
};

const GameContext = createContext<GameContextState | undefined>(undefined);

const defaultRoomConfig: RoomConfig = {
  categorySelection: "random",
  questionCount: 25,
  timerSpeed: "standard",
  dailyDoubleCount: 2,
  finalJeopardyEnabled: true
};

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { socket, isConnected } = useSocket();
  const { userId: persistedUserId, userName: persistedUserName } = useUserContext();

  useEffect(() => {
    const onRoomCreated = (payload: { playerId: string | null; room: SerializedRoom }) => {
      dispatch({ type: "SET_PLAYER_ID", playerId: payload.playerId });
      dispatch({ type: "SET_ROOM", room: payload.room });
      dispatch({ type: "CLEAR_FINAL_STATE" });
      dispatch({ type: "CLEAR_GAME_OVER" });
      dispatch({ type: "CLEAR_ROOM_ACTION_PENDING" });
      dispatch({ type: "CLEAR_ERROR" });
    };

    const onRoomJoined = (payload: { playerId: string | null; room: SerializedRoom }) => {
      dispatch({ type: "SET_PLAYER_ID", playerId: payload.playerId });
      dispatch({ type: "SET_ROOM", room: payload.room });
      dispatch({ type: "CLEAR_FINAL_STATE" });
      dispatch({ type: "CLEAR_GAME_OVER" });
      dispatch({ type: "CLEAR_ROOM_ACTION_PENDING" });
      dispatch({ type: "CLEAR_ERROR" });
    };

    const onRoomState = (payload: { room: SerializedRoom }) => {
      dispatch({ type: "SET_ROOM", room: payload.room });
    };

    const onRoomLeft = () => {
      dispatch({ type: "CLEAR_ROOM" });
      dispatch({ type: "CLEAR_ROOM_ACTION_PENDING" });
    };

    const onGameStarted = () => {
      dispatch({ type: "CLEAR_FINAL_STATE" });
      dispatch({ type: "CLEAR_GAME_OVER" });
    };

    const onFinalWagerPhase = (payload: FinalJeopardyWagerPhasePayload) => {
      dispatch({ type: "SET_FINAL_WAGER_PHASE", payload });
    };

    const onFinalAnswerPhase = (payload: FinalJeopardyAnswerPhasePayload) => {
      dispatch({ type: "SET_FINAL_ANSWER_PHASE", payload });
    };

    const onFinalReveal = (payload: FinalJeopardyRevealPayload) => {
      dispatch({ type: "SET_FINAL_REVEAL", payload });
    };

    const onGameOver = (payload: GameOverPayload) => {
      dispatch({ type: "SET_GAME_OVER", payload });
    };

    const onError = (payload: ServerErrorPayload) => {
      dispatch({ type: "SET_ERROR", message: payload.message });
      dispatch({ type: "CLEAR_ROOM_ACTION_PENDING" });
    };

    socket.on(SERVER_EVENTS.ROOM_CREATED, onRoomCreated);
    socket.on(SERVER_EVENTS.ROOM_JOINED, onRoomJoined);
    socket.on(SERVER_EVENTS.ROOM_STATE, onRoomState);
    socket.on(SERVER_EVENTS.ROOM_LEFT, onRoomLeft);
    socket.on(SERVER_EVENTS.GAME_STARTED, onGameStarted);
    socket.on(SERVER_EVENTS.FINAL_JEOPARDY_WAGER_PHASE, onFinalWagerPhase);
    socket.on(SERVER_EVENTS.FINAL_JEOPARDY_ANSWER_PHASE, onFinalAnswerPhase);
    socket.on(SERVER_EVENTS.FINAL_JEOPARDY_REVEAL, onFinalReveal);
    socket.on(SERVER_EVENTS.GAME_OVER, onGameOver);
    socket.on(SERVER_EVENTS.ERROR, onError);

    return () => {
      socket.off(SERVER_EVENTS.ROOM_CREATED, onRoomCreated);
      socket.off(SERVER_EVENTS.ROOM_JOINED, onRoomJoined);
      socket.off(SERVER_EVENTS.ROOM_STATE, onRoomState);
      socket.off(SERVER_EVENTS.ROOM_LEFT, onRoomLeft);
      socket.off(SERVER_EVENTS.GAME_STARTED, onGameStarted);
      socket.off(SERVER_EVENTS.FINAL_JEOPARDY_WAGER_PHASE, onFinalWagerPhase);
      socket.off(SERVER_EVENTS.FINAL_JEOPARDY_ANSWER_PHASE, onFinalAnswerPhase);
      socket.off(SERVER_EVENTS.FINAL_JEOPARDY_REVEAL, onFinalReveal);
      socket.off(SERVER_EVENTS.GAME_OVER, onGameOver);
      socket.off(SERVER_EVENTS.ERROR, onError);
    };
  }, [socket]);

  useEffect(() => {
    if (!isConnected || !socket.id || !state.room || !state.playerId) {
      return;
    }

    if (socket.id === state.playerId) {
      return;
    }

    if (!persistedUserId || !persistedUserName) {
      return;
    }

    socket.emit(CLIENT_EVENTS.JOIN_ROOM, {
      roomCode: state.room.code,
      userId: persistedUserId,
      userName: persistedUserName
    });
  }, [
    isConnected,
    socket,
    state.room,
    state.playerId,
    persistedUserId,
    persistedUserName
  ]);

  const createRoom = useCallback(
    (input: { userId: string; userName: string; config: RoomConfig }) => {
      dispatch({ type: "SET_ROOM_ACTION_PENDING", roomAction: "creating" });
      socket.emit(CLIENT_EVENTS.CREATE_ROOM, {
        userId: input.userId,
        userName: input.userName,
        config: input.config ?? defaultRoomConfig
      });
    },
    [socket]
  );

  const joinRoom = useCallback(
    (input: { roomCode: string; userId: string; userName: string; asSpectator?: boolean }) => {
      dispatch({ type: "SET_ROOM_ACTION_PENDING", roomAction: "joining" });
      socket.emit(CLIENT_EVENTS.JOIN_ROOM, {
        roomCode: input.roomCode.trim().toUpperCase(),
        userId: input.userId,
        userName: input.userName,
        asSpectator: input.asSpectator
      });
    },
    [socket]
  );

  const leaveRoom = useCallback(() => {
    if (!state.room) {
      dispatch({ type: "CLEAR_ROOM" });
      dispatch({ type: "CLEAR_ROOM_ACTION_PENDING" });
      return;
    }
    socket.emit(CLIENT_EVENTS.LEAVE_ROOM, { roomCode: state.room.code });
    dispatch({ type: "CLEAR_ROOM" });
    dispatch({ type: "CLEAR_ROOM_ACTION_PENDING" });
  }, [socket, state.room]);

  const startGame = useCallback(() => {
    if (!state.room) {
      return;
    }
    socket.emit(CLIENT_EVENTS.START_GAME, { roomCode: state.room.code });
  }, [socket, state.room]);

  const selectQuestion = useCallback(
    (questionId: string) => {
      socket.emit(CLIENT_EVENTS.SELECT_QUESTION, { questionId });
    },
    [socket]
  );

  const buzzIn = useCallback(() => {
    socket.emit(CLIENT_EVENTS.BUZZ_IN, { timestamp: Date.now() });
  }, [socket]);

  const submitAnswer = useCallback(
    (answer: string) => {
      socket.emit(CLIENT_EVENTS.SUBMIT_ANSWER, { answer });
    },
    [socket]
  );

  const submitWager = useCallback(
    (wager: number) => {
      socket.emit(CLIENT_EVENTS.SUBMIT_WAGER, { wager });
    },
    [socket]
  );

  const submitFinalWager = useCallback(
    (wager: number) => {
      socket.emit(CLIENT_EVENTS.SUBMIT_FINAL_WAGER, { wager });
    },
    [socket]
  );

  const submitFinalAnswer = useCallback(
    (answer: string) => {
      socket.emit(CLIENT_EVENTS.SUBMIT_FINAL_ANSWER, { answer });
    },
    [socket]
  );

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  const clearRoomActionPending = useCallback(() => {
    dispatch({ type: "CLEAR_ROOM_ACTION_PENDING" });
  }, []);

  const value = useMemo<GameContextState>(
    () => ({
      room: state.room,
      playerId: state.playerId,
      isInRoom: state.room !== null,
      error: state.error,
      isConnected,
      finalJeopardyWagerPhase: state.finalJeopardyWagerPhase,
      finalJeopardyAnswerPhase: state.finalJeopardyAnswerPhase,
      finalJeopardyReveal: state.finalJeopardyReveal,
      gameOver: state.gameOver,
      isRoomActionPending: state.isRoomActionPending,
      roomAction: state.roomAction,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      selectQuestion,
      buzzIn,
      submitAnswer,
      submitWager,
      submitFinalWager,
      submitFinalAnswer,
      clearRoomActionPending,
      clearError
    }),
    [
      state.room,
      state.playerId,
      state.error,
      state.finalJeopardyWagerPhase,
      state.finalJeopardyAnswerPhase,
      state.finalJeopardyReveal,
      state.gameOver,
      state.isRoomActionPending,
      state.roomAction,
      isConnected,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      selectQuestion,
      buzzIn,
      submitAnswer,
      submitWager,
      submitFinalWager,
      submitFinalAnswer,
      clearRoomActionPending,
      clearError
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGameContext = (): GameContextState => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameContext must be used inside GameProvider");
  }
  return context;
};
