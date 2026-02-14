import type {
  AnswerResult,
  CreateUserPayload,
  FinalJeopardyReveal,
  GameResult,
  GetUserStatsPayload,
  Player,
  PublicQuestion,
  RoomConfig,
  SerializedRoom,
  ServerErrorPayload,
  UserCreatedPayload,
  UserStatsPayload
} from "./types.js";

export const CLIENT_EVENTS = {
  CREATE_USER: "CREATE_USER",
  GET_USER_STATS: "GET_USER_STATS",
  CREATE_ROOM: "CREATE_ROOM",
  JOIN_ROOM: "JOIN_ROOM",
  LIST_ROOMS: "LIST_ROOMS",
  LEAVE_ROOM: "LEAVE_ROOM",
  START_GAME: "START_GAME",
  SELECT_QUESTION: "SELECT_QUESTION",
  BUZZ_IN: "BUZZ_IN",
  SUBMIT_ANSWER: "SUBMIT_ANSWER",
  SUBMIT_WAGER: "SUBMIT_WAGER",
  SUBMIT_FINAL_WAGER: "SUBMIT_FINAL_WAGER",
  SUBMIT_FINAL_ANSWER: "SUBMIT_FINAL_ANSWER"
} as const;

export const SERVER_EVENTS = {
  USER_CREATED: "USER_CREATED",
  USER_STATS: "USER_STATS",
  ROOM_CREATED: "ROOM_CREATED",
  ROOM_JOINED: "ROOM_JOINED",
  ROOM_LEFT: "ROOM_LEFT",
  ROOM_STATE: "ROOM_STATE",
  ROOM_LIST: "ROOM_LIST",
  PLAYER_JOINED: "PLAYER_JOINED",
  PLAYER_LEFT: "PLAYER_LEFT",
  PLAYER_DISCONNECTED: "PLAYER_DISCONNECTED",
  PLAYER_RECONNECTED: "PLAYER_RECONNECTED",
  GAME_STARTED: "GAME_STARTED",
  QUESTION_SELECTED: "QUESTION_SELECTED",
  READING_PHASE: "READING_PHASE",
  BUZZER_ACTIVE: "BUZZER_ACTIVE",
  PLAYER_BUZZED: "PLAYER_BUZZED",
  ANSWER_RESULT: "ANSWER_RESULT",
  DAILY_DOUBLE: "DAILY_DOUBLE",
  QUESTION_COMPLETE: "QUESTION_COMPLETE",
  FINAL_JEOPARDY_START: "FINAL_JEOPARDY_START",
  FINAL_JEOPARDY_WAGER_PHASE: "FINAL_JEOPARDY_WAGER_PHASE",
  FINAL_JEOPARDY_ANSWER_PHASE: "FINAL_JEOPARDY_ANSWER_PHASE",
  FINAL_JEOPARDY_REVEAL: "FINAL_JEOPARDY_REVEAL",
  GAME_OVER: "GAME_OVER",
  ERROR: "ERROR"
} as const;

export interface CreateRoomPayload {
  userId: string;
  userName: string;
  config: RoomConfig;
}

export interface JoinRoomPayload {
  roomCode: string;
  userId: string;
  userName: string;
  asSpectator?: boolean;
}

export interface ListRoomsPayload {}

export interface LeaveRoomPayload {
  roomCode: string;
}

export interface StartGamePayload {
  roomCode: string;
}

export interface SelectQuestionPayload {
  questionId: string;
}

export interface BuzzInPayload {
  timestamp?: number;
}

export interface SubmitAnswerPayload {
  answer: string;
}

export interface SubmitWagerPayload {
  wager: number;
}

export interface SubmitFinalWagerPayload {
  wager: number;
}

export interface SubmitFinalAnswerPayload {
  answer: string;
}

export interface RoomCreatedPayload {
  roomCode: string;
  playerId: string;
  room: SerializedRoom;
}

export interface RoomJoinedPayload {
  roomCode: string;
  playerId: string | null;
  room: SerializedRoom;
}

export interface RoomLeftPayload {
  roomCode: string;
}

export interface RoomStatePayload {
  room: SerializedRoom;
  serverTime: number;
}

export interface RoomSummaryPayload {
  code: string;
  status: SerializedRoom["status"];
  playerCount: number;
  connectedPlayerCount: number;
  createdAt: number;
  startedAt: number | null;
}

export interface RoomListPayload {
  rooms: RoomSummaryPayload[];
}

export interface PlayerJoinedPayload {
  player: Player;
}

export interface PlayerLeftPayload {
  playerId: string;
}

export interface PlayerDisconnectedPayload {
  playerId: string;
  reconnectDeadline: number;
}

export interface PlayerReconnectedPayload {
  previousPlayerId: string;
  player: Player;
}

export interface GameStartedPayload {
  room: SerializedRoom;
  firstPlayer: string;
}

export interface QuestionSelectedPayload {
  question: PublicQuestion;
  selectingPlayer: string;
}

export interface ReadingPhasePayload {
  question: string;
  value: number;
  phaseEndsAt: number;
}

export interface BuzzerActivePayload {
  phaseEndsAt: number;
}

export interface PlayerBuzzedPayload {
  playerId: string;
  playerName: string;
  phaseEndsAt: number;
}

export interface AnswerResultPayload {
  playerId: string;
  result: AnswerResult;
  nextTurnPlayerId: string;
}

export interface DailyDoublePayload {
  question: PublicQuestion;
  minWager: number;
  maxWager: number;
  phaseEndsAt: number;
}

export interface QuestionCompletePayload {
  questionId: string;
  correctAnswer: string;
}

export interface FinalJeopardyStartPayload {
  category: string;
}

export interface FinalJeopardyWagerLimit {
  playerId: string;
  minWager: number;
  maxWager: number;
  currentScore: number;
}

export interface FinalJeopardyWagerPhasePayload {
  category: string;
  phaseEndsAt: number;
  limits: FinalJeopardyWagerLimit[];
}

export interface FinalJeopardyAnswerPhasePayload {
  category: string;
  question: string;
  phaseEndsAt: number;
}

export interface FinalJeopardyRevealPayload {
  correctAnswer: string;
  reveals: FinalJeopardyReveal[];
  winnerId: string;
}

export interface GameOverPayload {
  winner: Player;
  allPlayers: Player[];
  gameResult: GameResult;
  statsUpdated: boolean;
}

export interface ClientToServerEvents {
  [CLIENT_EVENTS.CREATE_USER]: (payload: CreateUserPayload) => void;
  [CLIENT_EVENTS.GET_USER_STATS]: (payload: GetUserStatsPayload) => void;
  [CLIENT_EVENTS.CREATE_ROOM]: (payload: CreateRoomPayload) => void;
  [CLIENT_EVENTS.JOIN_ROOM]: (payload: JoinRoomPayload) => void;
  [CLIENT_EVENTS.LIST_ROOMS]: (payload: ListRoomsPayload) => void;
  [CLIENT_EVENTS.LEAVE_ROOM]: (payload: LeaveRoomPayload) => void;
  [CLIENT_EVENTS.START_GAME]: (payload: StartGamePayload) => void;
  [CLIENT_EVENTS.SELECT_QUESTION]: (payload: SelectQuestionPayload) => void;
  [CLIENT_EVENTS.BUZZ_IN]: (payload: BuzzInPayload) => void;
  [CLIENT_EVENTS.SUBMIT_ANSWER]: (payload: SubmitAnswerPayload) => void;
  [CLIENT_EVENTS.SUBMIT_WAGER]: (payload: SubmitWagerPayload) => void;
  [CLIENT_EVENTS.SUBMIT_FINAL_WAGER]: (payload: SubmitFinalWagerPayload) => void;
  [CLIENT_EVENTS.SUBMIT_FINAL_ANSWER]: (payload: SubmitFinalAnswerPayload) => void;
}

export interface ServerToClientEvents {
  [SERVER_EVENTS.USER_CREATED]: (payload: UserCreatedPayload) => void;
  [SERVER_EVENTS.USER_STATS]: (payload: UserStatsPayload) => void;
  [SERVER_EVENTS.ROOM_CREATED]: (payload: RoomCreatedPayload) => void;
  [SERVER_EVENTS.ROOM_JOINED]: (payload: RoomJoinedPayload) => void;
  [SERVER_EVENTS.ROOM_LEFT]: (payload: RoomLeftPayload) => void;
  [SERVER_EVENTS.ROOM_STATE]: (payload: RoomStatePayload) => void;
  [SERVER_EVENTS.ROOM_LIST]: (payload: RoomListPayload) => void;
  [SERVER_EVENTS.PLAYER_JOINED]: (payload: PlayerJoinedPayload) => void;
  [SERVER_EVENTS.PLAYER_LEFT]: (payload: PlayerLeftPayload) => void;
  [SERVER_EVENTS.PLAYER_DISCONNECTED]: (payload: PlayerDisconnectedPayload) => void;
  [SERVER_EVENTS.PLAYER_RECONNECTED]: (payload: PlayerReconnectedPayload) => void;
  [SERVER_EVENTS.GAME_STARTED]: (payload: GameStartedPayload) => void;
  [SERVER_EVENTS.QUESTION_SELECTED]: (payload: QuestionSelectedPayload) => void;
  [SERVER_EVENTS.READING_PHASE]: (payload: ReadingPhasePayload) => void;
  [SERVER_EVENTS.BUZZER_ACTIVE]: (payload: BuzzerActivePayload) => void;
  [SERVER_EVENTS.PLAYER_BUZZED]: (payload: PlayerBuzzedPayload) => void;
  [SERVER_EVENTS.ANSWER_RESULT]: (payload: AnswerResultPayload) => void;
  [SERVER_EVENTS.DAILY_DOUBLE]: (payload: DailyDoublePayload) => void;
  [SERVER_EVENTS.QUESTION_COMPLETE]: (payload: QuestionCompletePayload) => void;
  [SERVER_EVENTS.FINAL_JEOPARDY_START]: (payload: FinalJeopardyStartPayload) => void;
  [SERVER_EVENTS.FINAL_JEOPARDY_WAGER_PHASE]: (payload: FinalJeopardyWagerPhasePayload) => void;
  [SERVER_EVENTS.FINAL_JEOPARDY_ANSWER_PHASE]: (payload: FinalJeopardyAnswerPhasePayload) => void;
  [SERVER_EVENTS.FINAL_JEOPARDY_REVEAL]: (payload: FinalJeopardyRevealPayload) => void;
  [SERVER_EVENTS.GAME_OVER]: (payload: GameOverPayload) => void;
  [SERVER_EVENTS.ERROR]: (payload: ServerErrorPayload) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  roomCode?: string;
  userId?: string;
}
