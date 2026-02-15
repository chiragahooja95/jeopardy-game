import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  getGameTiming,
  toPublicQuestion,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData
} from "@jeopardy/shared";
import type { Server, Socket } from "socket.io";
import type { StatsRepository } from "../database/repositories/StatsRepository.js";
import { BuzzerManager } from "../managers/BuzzerManager.js";
import { FinalJeopardyManager } from "../managers/FinalJeopardyManager.js";
import { GameStateManager } from "../managers/GameStateManager.js";
import { RoomManager } from "../managers/RoomManager.js";

interface GameHandlerDeps {
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  roomManager: RoomManager;
  gameStateManager: GameStateManager;
  buzzerManager: BuzzerManager;
  finalJeopardyManager: FinalJeopardyManager;
  statsRepository: StatsRepository;
}

const roomTimers = new Map<string, NodeJS.Timeout>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const spectatorSockets = new Map<string, string>();

const clearRoomTimer = (roomCode: string) => {
  const existing = roomTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    roomTimers.delete(roomCode);
  }
};

const scheduleRoomTimer = (roomCode: string, ms: number, callback: () => void) => {
  clearRoomTimer(roomCode);
  const timeout = setTimeout(() => {
    roomTimers.delete(roomCode);
    callback();
  }, Math.max(ms, 0));
  roomTimers.set(roomCode, timeout);
};

const clearDisconnectTimer = (playerId: string) => {
  const existing = disconnectTimers.get(playerId);
  if (!existing) {
    return;
  }

  clearTimeout(existing);
  disconnectTimers.delete(playerId);
};

const emitError = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  message: string
) => {
  socket.emit(SERVER_EVENTS.ERROR, { message });
};

const findRoomForSocket = (
  deps: GameHandlerDeps,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) => {
  const room = deps.roomManager.getRoomForPlayer(socket.id);
  if (!room) {
    emitError(socket, "Player is not in a room.");
    return null;
  }
  return room;
};

const registerStateEmitter = (deps: GameHandlerDeps) => {
  const emitRoomState = (roomCode: string) => {
    const room = deps.roomManager.getRoomByCode(roomCode);
    if (!room) {
      return;
    }

    deps.io.to(roomCode).emit(SERVER_EVENTS.ROOM_STATE, {
      room: deps.roomManager.serializeRoom(room),
      serverTime: Date.now()
    });
  };

  return { emitRoomState };
};

const registerGameFinisher = (deps: GameHandlerDeps, emitRoomState: (roomCode: string) => void) => {
  const finishStandardGame = (roomCode: string) => {
    const room = deps.roomManager.getRoomByCode(roomCode);
    if (!room || room.status === "finished") {
      return;
    }

    const { winner, result } = deps.gameStateManager.createGameResult(room);
    room.status = "finished";

    let statsUpdated = true;
    try {
      deps.statsRepository.recordGameCompletion(result);
    } catch {
      statsUpdated = false;
    }

    deps.io.to(roomCode).emit(SERVER_EVENTS.GAME_OVER, {
      winner,
      allPlayers: [...room.players.values()],
      gameResult: result,
      statsUpdated
    });

    emitRoomState(roomCode);
    clearRoomTimer(roomCode);
  };

  const finalizeFinalJeopardy = (roomCode: string) => {
    const room = deps.roomManager.getRoomByCode(roomCode);
    if (!room || room.status === "finished") {
      return;
    }

    const final = deps.finalJeopardyManager.finalize(room);

    let statsUpdated = true;
    try {
      deps.statsRepository.recordGameCompletion(final.gameResult);
    } catch {
      statsUpdated = false;
    }

    deps.io.to(roomCode).emit(SERVER_EVENTS.FINAL_JEOPARDY_REVEAL, {
      correctAnswer: final.correctAnswer,
      reveals: final.reveals,
      winnerId: final.winner.id
    });

    deps.io.to(roomCode).emit(SERVER_EVENTS.GAME_OVER, {
      winner: final.winner,
      allPlayers: [...room.players.values()],
      gameResult: final.gameResult,
      statsUpdated
    });

    emitRoomState(roomCode);
    clearRoomTimer(roomCode);
    deps.finalJeopardyManager.clear(roomCode);
  };

  const startFinalAnswerPhase = (roomCode: string) => {
    const room = deps.roomManager.getRoomByCode(roomCode);
    if (!room || room.status !== "final_jeopardy" || room.gameState.phase !== "final_jeopardy_wager") {
      return;
    }

    const answer = deps.finalJeopardyManager.startAnswerPhase(room);
    deps.io.to(roomCode).emit(SERVER_EVENTS.FINAL_JEOPARDY_ANSWER_PHASE, {
      category: answer.category,
      question: answer.question,
      phaseEndsAt: answer.answerEndsAt
    });

    emitRoomState(roomCode);

    scheduleRoomTimer(roomCode, answer.answerEndsAt - Date.now(), () => {
      finalizeFinalJeopardy(roomCode);
    });
  };

  const startFinalJeopardy = (roomCode: string) => {
    const room = deps.roomManager.getRoomByCode(roomCode);
    if (!room || room.status === "finished") {
      return;
    }

    const start = deps.finalJeopardyManager.startFinalJeopardy(room);
    const limits = deps.finalJeopardyManager.getWagerLimits(room);

    deps.io.to(roomCode).emit(SERVER_EVENTS.FINAL_JEOPARDY_START, {
      category: start.category
    });

    deps.io.to(roomCode).emit(SERVER_EVENTS.FINAL_JEOPARDY_WAGER_PHASE, {
      category: start.category,
      phaseEndsAt: start.wagerEndsAt,
      limits
    });

    emitRoomState(roomCode);

    scheduleRoomTimer(roomCode, start.wagerEndsAt - Date.now(), () => {
      startFinalAnswerPhase(roomCode);
    });
  };

  const maybeCompleteGame = (roomCode: string): boolean => {
    const room = deps.roomManager.getRoomByCode(roomCode);
    if (!room) {
      return false;
    }

    if (!deps.gameStateManager.isGameComplete(room)) {
      return false;
    }

    if (room.config.finalJeopardyEnabled) {
      startFinalJeopardy(roomCode);
      return true;
    }

    finishStandardGame(roomCode);
    return true;
  };

  return {
    finishStandardGame,
    finalizeFinalJeopardy,
    startFinalAnswerPhase,
    maybeCompleteGame
  };
};

export const registerGameHandlers = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  deps: GameHandlerDeps
) => {
  const { emitRoomState } = registerStateEmitter(deps);
  const { finishStandardGame, finalizeFinalJeopardy, startFinalAnswerPhase, maybeCompleteGame } =
    registerGameFinisher(deps, emitRoomState);

  const handleDailyDoubleTimeout = (roomCode: string) => {
    const timedRoom = deps.roomManager.getRoomByCode(roomCode);
    if (!timedRoom || timedRoom.gameState.phase !== "daily_double") {
      return;
    }

    const dailyPlayerId = timedRoom.gameState.dailyDoublePlayerId;
    if (!dailyPlayerId) {
      const completion = deps.gameStateManager.completeQuestionNoAnswer(timedRoom);
      deps.io.to(timedRoom.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, completion);
      emitRoomState(timedRoom.code);
      maybeCompleteGame(timedRoom.code);
      return;
    }

    try {
      const result = deps.gameStateManager.submitAnswer(timedRoom, dailyPlayerId, "");

      deps.io.to(timedRoom.code).emit(SERVER_EVENTS.ANSWER_RESULT, {
        playerId: dailyPlayerId,
        result: result.result,
        nextTurnPlayerId: result.nextTurnPlayerId
      });

      if (result.questionCompleted && result.completedQuestionId && result.completedCorrectAnswer) {
        deps.io.to(timedRoom.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, {
          questionId: result.completedQuestionId,
          correctAnswer: result.completedCorrectAnswer,
          attempts: result.completedAttempts ?? []
        });
      }

      emitRoomState(timedRoom.code);
      maybeCompleteGame(timedRoom.code);
    } catch {
      const completion = deps.gameStateManager.completeQuestionNoAnswer(timedRoom);
      deps.io.to(timedRoom.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, completion);
      emitRoomState(timedRoom.code);
      maybeCompleteGame(timedRoom.code);
    }
  };

  const maybeCompleteQuestionIfNoEligibleBuzzers = (roomCode: string): boolean => {
    const room = deps.roomManager.getRoomByCode(roomCode);
    if (!room || room.gameState.phase !== "buzzer_active") {
      return false;
    }

    const hasEligibleBuzzer = [...room.players.values()].some(
      (player) =>
        player.connected &&
        !player.buzzerLocked &&
        !deps.buzzerManager.isPlayerLocked(room.code, player.id)
    );

    if (hasEligibleBuzzer) {
      return false;
    }

    const completion = deps.gameStateManager.completeQuestionNoAnswer(room);
    deps.io.to(room.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, completion);
    emitRoomState(room.code);
    maybeCompleteGame(room.code);
    return true;
  };

  const handlePlayerRemoved = (left: {
    room: ReturnType<RoomManager["getRoomByCode"]> extends infer T ? Exclude<T, null> : never;
    playerId: string;
    roomDeleted: boolean;
    newHostId: string | null;
  }) => {
    if (left.roomDeleted) {
      clearRoomTimer(left.room.code);
      deps.finalJeopardyManager.clear(left.room.code);
      return;
    }

    deps.io.to(left.room.code).emit(SERVER_EVENTS.PLAYER_LEFT, {
      playerId: left.playerId
    });

    if (left.room.status !== "lobby") {
      const connected = [...left.room.players.values()].filter((player) => player.connected).length;
      if (connected < 2) {
        finishStandardGame(left.room.code);
        return;
      }
    }

    emitRoomState(left.room.code);
  };

  socket.on(CLIENT_EVENTS.CREATE_ROOM, (payload) => {
    try {
      const room = deps.roomManager.createRoom({
        socketId: socket.id,
        userId: payload.userId,
        userName: payload.userName,
        config: payload.config
      });

      socket.data.roomCode = room.code;
      socket.data.userId = payload.userId;
      socket.join(room.code);

      socket.emit(SERVER_EVENTS.ROOM_CREATED, {
        roomCode: room.code,
        playerId: socket.id,
        room: deps.roomManager.serializeRoom(room)
      });

      emitRoomState(room.code);
    } catch {
      emitError(socket, "Failed to create room.");
    }
  });

  socket.on(CLIENT_EVENTS.JOIN_ROOM, (payload) => {
    const normalizedRoomCode = payload.roomCode.trim().toUpperCase();
    const joined = deps.roomManager.joinRoom(normalizedRoomCode, {
      socketId: socket.id,
      userId: payload.userId,
      userName: payload.userName
    });

    if (!joined) {
      const room = deps.roomManager.getRoomByCode(normalizedRoomCode);
      if (!room) {
        emitError(socket, "Unable to join room.");
        return;
      }

      socket.data.roomCode = room.code;
      socket.data.userId = payload.userId;
      socket.join(room.code);
      spectatorSockets.set(socket.id, room.code);

      socket.emit(SERVER_EVENTS.ROOM_JOINED, {
        roomCode: room.code,
        playerId: null,
        room: deps.roomManager.serializeRoom(room)
      });

      emitRoomState(room.code);
      return;
    }

    socket.data.roomCode = joined.room.code;
    socket.data.userId = payload.userId;
    socket.join(joined.room.code);
    spectatorSockets.delete(socket.id);

    socket.emit(SERVER_EVENTS.ROOM_JOINED, {
      roomCode: joined.room.code,
      playerId: socket.id,
      room: deps.roomManager.serializeRoom(joined.room)
    });

    if (joined.reconnected && joined.previousPlayerId) {
      clearDisconnectTimer(joined.previousPlayerId);
      deps.io.to(joined.room.code).emit(SERVER_EVENTS.PLAYER_RECONNECTED, {
        previousPlayerId: joined.previousPlayerId,
        player: joined.player
      });
    } else {
      socket.to(joined.room.code).emit(SERVER_EVENTS.PLAYER_JOINED, {
        player: joined.player
      });
    }

    emitRoomState(joined.room.code);
  });

  socket.on(CLIENT_EVENTS.LIST_ROOMS, () => {
    socket.emit(SERVER_EVENTS.ROOM_LIST, {
      rooms: deps.roomManager.listRoomSummaries()
    });
  });

  socket.on(CLIENT_EVENTS.LEAVE_ROOM, () => {
    const spectatorRoomCode = spectatorSockets.get(socket.id);
    if (spectatorRoomCode) {
      spectatorSockets.delete(socket.id);
      socket.leave(spectatorRoomCode);
      socket.emit(SERVER_EVENTS.ROOM_LEFT, { roomCode: spectatorRoomCode });
      return;
    }

    clearDisconnectTimer(socket.id);
    const left = deps.roomManager.leaveRoom(socket.id);
    if (!left) {
      return;
    }

    socket.leave(left.room.code);
    handlePlayerRemoved(left);
  });

  socket.on(CLIENT_EVENTS.START_GAME, () => {
    const room = findRoomForSocket(deps, socket);
    if (!room) {
      return;
    }

    if (room.hostId !== socket.id) {
      emitError(socket, "Only the host can start the game.");
      return;
    }

    try {
      deps.gameStateManager.startGame(room);
      deps.buzzerManager.reset(room.code);

      deps.io.to(room.code).emit(SERVER_EVENTS.GAME_STARTED, {
        room: deps.roomManager.serializeRoom(room),
        firstPlayer: room.gameState.currentTurnPlayerId
      });

      emitRoomState(room.code);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start game.";
      emitError(socket, message);
    }
  });

  socket.on(CLIENT_EVENTS.SELECT_QUESTION, (payload) => {
    const room = findRoomForSocket(deps, socket);
    if (!room) {
      return;
    }

    try {
      const selected = deps.gameStateManager.selectQuestion(room, socket.id, payload.questionId);
      const publicQuestion = toPublicQuestion(selected.question);

      deps.io.to(room.code).emit(SERVER_EVENTS.QUESTION_SELECTED, {
        question: publicQuestion,
        selectingPlayer: socket.id
      });

      deps.io.to(room.code).emit(SERVER_EVENTS.READING_PHASE, {
        question: selected.question.question,
        value: selected.question.value,
        phaseEndsAt: selected.phaseEndsAt
      });

      emitRoomState(room.code);

      scheduleRoomTimer(room.code, selected.phaseEndsAt - Date.now(), () => {
        const activeRoom = deps.roomManager.getRoomByCode(room.code);
        if (!activeRoom || activeRoom.gameState.phase !== "reading" || !activeRoom.gameState.selectedQuestion) {
          return;
        }

        if (activeRoom.gameState.selectedQuestion.dailyDouble) {
          try {
            const daily = deps.gameStateManager.activateDailyDouble(
              activeRoom,
              activeRoom.gameState.currentTurnPlayerId
            );

            deps.io.to(activeRoom.code).emit(SERVER_EVENTS.DAILY_DOUBLE, {
              question: toPublicQuestion(activeRoom.gameState.selectedQuestion),
              minWager: daily.min,
              maxWager: daily.max,
              phaseEndsAt: daily.phaseEndsAt
            });

            emitRoomState(activeRoom.code);
          } catch {
            // no-op; invalid state transition
          }

          return;
        }

        deps.buzzerManager.prepareForQuestion(activeRoom.code);
        const buzzerEndsAt = deps.gameStateManager.activateBuzzer(activeRoom);

        deps.io.to(activeRoom.code).emit(SERVER_EVENTS.BUZZER_ACTIVE, {
          phaseEndsAt: buzzerEndsAt
        });

        emitRoomState(activeRoom.code);

        scheduleRoomTimer(activeRoom.code, buzzerEndsAt - Date.now(), () => {
          const timedRoom = deps.roomManager.getRoomByCode(activeRoom.code);
          if (!timedRoom || timedRoom.gameState.phase !== "buzzer_active") {
            return;
          }

          const completion = deps.gameStateManager.completeQuestionNoAnswer(timedRoom);
          deps.io.to(timedRoom.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, completion);
          emitRoomState(timedRoom.code);
          maybeCompleteGame(timedRoom.code);
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to select question.";
      emitError(socket, message);
    }
  });

  socket.on(CLIENT_EVENTS.BUZZ_IN, () => {
    const room = findRoomForSocket(deps, socket);
    if (!room || room.gameState.phase !== "buzzer_active") {
      return;
    }

    const player = room.players.get(socket.id);
    if (!player) {
      return;
    }

    if (player.buzzerLocked) {
      emitRoomState(room.code);
      return;
    }

    player.buzzerAttempts += 1;
    const winnerId = deps.buzzerManager.handleBuzz(room.code, socket.id);
    if (!winnerId) {
      emitRoomState(room.code);
      return;
    }

    try {
      const phaseEndsAt = deps.gameStateManager.setBuzzWinner(room, winnerId);
      const winner = room.players.get(winnerId);
      if (!winner) {
        return;
      }

      deps.io.to(room.code).emit(SERVER_EVENTS.PLAYER_BUZZED, {
        playerId: winnerId,
        playerName: winner.name,
        phaseEndsAt
      });

      emitRoomState(room.code);

      scheduleRoomTimer(room.code, phaseEndsAt - Date.now(), () => {
        const timedRoom = deps.roomManager.getRoomByCode(room.code);
        if (!timedRoom || timedRoom.gameState.phase !== "answering") {
          return;
        }

        const timedOutPlayerId = timedRoom.gameState.buzzedPlayerId;
        if (!timedOutPlayerId) {
          const completion = deps.gameStateManager.completeQuestionNoAnswer(timedRoom);
          deps.io.to(timedRoom.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, completion);
          emitRoomState(timedRoom.code);
          maybeCompleteGame(timedRoom.code);
          return;
        }

        const timeoutResult = deps.gameStateManager.submitAnswer(timedRoom, timedOutPlayerId, "");
        const timeoutPayload = {
          playerId: timedOutPlayerId,
          result: timeoutResult.result,
          nextTurnPlayerId: timeoutResult.nextTurnPlayerId
        };

        if (!timeoutResult.result.correct && !timeoutResult.questionCompleted) {
          deps.io.to(timedOutPlayerId).emit(SERVER_EVENTS.ANSWER_RESULT, timeoutPayload);
        } else {
          deps.io.to(timedRoom.code).emit(SERVER_EVENTS.ANSWER_RESULT, timeoutPayload);
        }

        deps.buzzerManager.unlockBuzzer(timedRoom.code);
        const nextPhaseEndsAt =
          timedRoom.gameState.phaseEndsAt ?? Date.now() + getGameTiming(timedRoom.config.timerSpeed).buzzerTimeout;
        const lockMs = Math.max(0, nextPhaseEndsAt - Date.now());
        const lockedUntil = deps.buzzerManager.lockPlayer(timedRoom.code, timedOutPlayerId, lockMs);
        const timedOutPlayer = timedRoom.players.get(timedOutPlayerId);
        if (timedOutPlayer) {
          timedOutPlayer.buzzerLocked = true;
          timedOutPlayer.buzzerLockedUntil = lockedUntil;
        }

        if (maybeCompleteQuestionIfNoEligibleBuzzers(timedRoom.code)) {
          return;
        }

        deps.io.to(timedRoom.code).emit(SERVER_EVENTS.BUZZER_ACTIVE, { phaseEndsAt: nextPhaseEndsAt });
        emitRoomState(timedRoom.code);

        scheduleRoomTimer(timedRoom.code, nextPhaseEndsAt - Date.now(), () => {
          const expiryRoom = deps.roomManager.getRoomByCode(timedRoom.code);
          if (!expiryRoom || expiryRoom.gameState.phase !== "buzzer_active") {
            return;
          }

          const completion = deps.gameStateManager.completeQuestionNoAnswer(expiryRoom);
          deps.io.to(expiryRoom.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, completion);
          emitRoomState(expiryRoom.code);
          maybeCompleteGame(expiryRoom.code);
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process buzzer input.";
      emitError(socket, message);
    }
  });

  socket.on(CLIENT_EVENTS.SUBMIT_WAGER, (payload) => {
    const room = findRoomForSocket(deps, socket);
    if (!room) {
      return;
    }

    try {
      deps.gameStateManager.submitDailyDoubleWager(room, socket.id, payload.wager);
      const phaseEndsAt = deps.gameStateManager.startDailyDoubleAnswerWindow(room);

      if (room.gameState.selectedQuestion) {
        const dailyPlayer = room.players.get(socket.id);
        const questionValue = room.gameState.selectedQuestion.value;
        const maxWager = Math.max(dailyPlayer?.score ?? 0, questionValue, 200);
        deps.io.to(room.code).emit(SERVER_EVENTS.DAILY_DOUBLE, {
          question: toPublicQuestion(room.gameState.selectedQuestion),
          minWager: 200,
          maxWager,
          phaseEndsAt
        });
      }

      emitRoomState(room.code);
      scheduleRoomTimer(room.code, phaseEndsAt - Date.now(), () => {
        handleDailyDoubleTimeout(room.code);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid wager.";
      emitError(socket, message);
    }
  });

  socket.on(CLIENT_EVENTS.SUBMIT_ANSWER, (payload) => {
    const room = findRoomForSocket(deps, socket);
    if (!room) {
      return;
    }

    try {
      const phaseBefore = room.gameState.phase;
      const result = deps.gameStateManager.submitAnswer(room, socket.id, payload.answer);
      const answerPayload = {
        playerId: socket.id,
        result: result.result,
        nextTurnPlayerId: result.nextTurnPlayerId
      };

      if (phaseBefore === "answering" && !result.result.correct && !result.questionCompleted) {
        socket.emit(SERVER_EVENTS.ANSWER_RESULT, answerPayload);
      } else {
        deps.io.to(room.code).emit(SERVER_EVENTS.ANSWER_RESULT, answerPayload);
      }

      if (result.questionCompleted && result.completedQuestionId && result.completedCorrectAnswer) {
        deps.io.to(room.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, {
          questionId: result.completedQuestionId,
          correctAnswer: result.completedCorrectAnswer,
          attempts: result.completedAttempts ?? []
        });

        emitRoomState(room.code);
        maybeCompleteGame(room.code);
        return;
      }

      if (phaseBefore === "answering" && !result.result.correct) {
        deps.buzzerManager.unlockBuzzer(room.code);
        const phaseEndsAt = room.gameState.phaseEndsAt ?? Date.now() + getGameTiming(room.config.timerSpeed).buzzerTimeout;
        const lockMs = Math.max(0, phaseEndsAt - Date.now());
        const lockedUntil = deps.buzzerManager.lockPlayer(room.code, socket.id, lockMs);

        const player = room.players.get(socket.id);
        if (player) {
          player.buzzerLocked = true;
          player.buzzerLockedUntil = lockedUntil;
        }

        if (maybeCompleteQuestionIfNoEligibleBuzzers(room.code)) {
          return;
        }

        deps.io.to(room.code).emit(SERVER_EVENTS.BUZZER_ACTIVE, { phaseEndsAt });

        scheduleRoomTimer(room.code, phaseEndsAt - Date.now(), () => {
          const timedRoom = deps.roomManager.getRoomByCode(room.code);
          if (!timedRoom || timedRoom.gameState.phase !== "buzzer_active") {
            return;
          }

          const completion = deps.gameStateManager.completeQuestionNoAnswer(timedRoom);
          deps.io.to(timedRoom.code).emit(SERVER_EVENTS.QUESTION_COMPLETE, completion);
          emitRoomState(timedRoom.code);
          maybeCompleteGame(timedRoom.code);
        });
      }

      emitRoomState(room.code);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit answer.";
      emitError(socket, message);
    }
  });

  socket.on(CLIENT_EVENTS.SUBMIT_FINAL_WAGER, (payload) => {
    const room = findRoomForSocket(deps, socket);
    if (!room || room.status !== "final_jeopardy") {
      return;
    }

    try {
      const result = deps.finalJeopardyManager.submitWager(room, socket.id, payload.wager);
      emitRoomState(room.code);

      if (result.allWagersSubmitted) {
        startFinalAnswerPhase(room.code);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid Final Jeopardy wager.";
      emitError(socket, message);
    }
  });

  socket.on(CLIENT_EVENTS.SUBMIT_FINAL_ANSWER, (payload) => {
    const room = findRoomForSocket(deps, socket);
    if (!room || room.status !== "final_jeopardy") {
      return;
    }

    try {
      const result = deps.finalJeopardyManager.submitAnswer(room, socket.id, payload.answer);
      emitRoomState(room.code);

      if (result.allAnswersSubmitted) {
        finalizeFinalJeopardy(room.code);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid Final Jeopardy answer.";
      emitError(socket, message);
    }
  });

  socket.on("disconnect", () => {
    spectatorSockets.delete(socket.id);

    const disconnected = deps.roomManager.disconnectPlayer(socket.id);
    if (!disconnected) {
      return;
    }

    deps.io.to(disconnected.room.code).emit(SERVER_EVENTS.PLAYER_DISCONNECTED, {
      playerId: disconnected.playerId,
      reconnectDeadline: disconnected.reconnectDeadline
    });
    emitRoomState(disconnected.room.code);

    clearDisconnectTimer(disconnected.playerId);
    const timeout = setTimeout(() => {
      disconnectTimers.delete(disconnected.playerId);
      const left = deps.roomManager.leaveRoom(disconnected.playerId);
      if (!left) {
        return;
      }
      handlePlayerRemoved(left);
    }, Math.max(0, disconnected.reconnectDeadline - Date.now()));

    disconnectTimers.set(disconnected.playerId, timeout);
  });
};
