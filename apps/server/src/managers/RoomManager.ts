import {
  GAME_CONFIG,
  generateRoomCode,
  type BoardQuestionCell,
  type Player,
  type Room,
  type RoomConfig,
  type SerializedRoom
} from "@jeopardy/shared";
import { randomUUID } from "node:crypto";

export interface CreateRoomInput {
  socketId: string;
  userId: string;
  userName: string;
  config: RoomConfig;
}

export interface JoinRoomInput {
  socketId: string;
  userId: string;
  userName: string;
}

export interface JoinRoomResult {
  room: Room;
  player: Player;
  reconnected: boolean;
  previousPlayerId: string | null;
}

const makeDefaultConfig = (): RoomConfig => ({
  categorySelection: "random",
  questionCount: 25,
  timerSpeed: "standard",
  dailyDoubleCount: 2,
  finalJeopardyEnabled: true
});

const createPlayer = ({
  socketId,
  userId,
  userName,
  isHost
}: {
  socketId: string;
  userId: string;
  userName: string;
  isHost: boolean;
}): Player => ({
  id: socketId,
  userId,
  name: userName,
  score: 0,
  isHost,
  connected: true,
  buzzerLocked: false,
  buzzerLockedUntil: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  buzzerAttempts: 0,
  buzzerWins: 0,
  dailyDoubleCorrect: 0,
  dailyDoubleWrong: 0
});

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  private readonly playerToRoom = new Map<string, string>();

  createRoom(input: CreateRoomInput): Room {
    let roomCode = this.generateUniqueRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = this.generateUniqueRoomCode();
    }

    const hostPlayer = createPlayer({
      socketId: input.socketId,
      userId: input.userId,
      userName: input.userName,
      isHost: true
    });

    const now = Date.now();
    const room: Room = {
      id: randomUUID(),
      code: roomCode,
      config: { ...makeDefaultConfig(), ...input.config },
      hostId: input.socketId,
      players: new Map([[input.socketId, hostPlayer]]),
      gameState: {
        board: [],
        phase: "selection",
        currentTurnPlayerId: input.socketId,
        selectedQuestion: null,
        phaseEndsAt: null,
        answeredQuestions: new Set(),
        buzzedPlayerId: null,
        dailyDoubleWager: null,
        dailyDoublePlayerId: null
      },
      status: "lobby",
      createdAt: now,
      startedAt: null
    };

    this.rooms.set(roomCode, room);
    this.playerToRoom.set(input.socketId, roomCode);

    return room;
  }

  joinRoom(roomCode: string, input: JoinRoomInput): JoinRoomResult | null {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return null;
    }

    const duplicateConnected = [...room.players.values()].find(
      (player) => player.userId === input.userId && player.connected
    );
    if (duplicateConnected) {
      return null;
    }

    const disconnectedMatch = [...room.players.entries()].find(
      ([, player]) => player.userId === input.userId && !player.connected
    );

    if (disconnectedMatch) {
      const [previousPlayerId, player] = disconnectedMatch;

      room.players.delete(previousPlayerId);
      this.playerToRoom.delete(previousPlayerId);

      player.id = input.socketId;
      player.name = input.userName;
      player.connected = true;

      room.players.set(input.socketId, player);
      this.playerToRoom.set(input.socketId, roomCode);

      if (room.hostId === previousPlayerId) {
        room.hostId = input.socketId;
      }
      if (room.gameState.currentTurnPlayerId === previousPlayerId) {
        room.gameState.currentTurnPlayerId = input.socketId;
      }
      if (room.gameState.buzzedPlayerId === previousPlayerId) {
        room.gameState.buzzedPlayerId = input.socketId;
      }
      if (room.gameState.dailyDoublePlayerId === previousPlayerId) {
        room.gameState.dailyDoublePlayerId = input.socketId;
      }

      return {
        room,
        player,
        reconnected: true,
        previousPlayerId
      };
    }

    if (room.status !== "lobby") {
      return null;
    }

    if (room.players.size >= GAME_CONFIG.MAX_PLAYERS) {
      return null;
    }

    const player = createPlayer({
      socketId: input.socketId,
      userId: input.userId,
      userName: input.userName,
      isHost: false
    });

    room.players.set(input.socketId, player);
    this.playerToRoom.set(input.socketId, roomCode);

    return {
      room,
      player,
      reconnected: false,
      previousPlayerId: null
    };
  }

  disconnectPlayer(socketId: string): {
    room: Room;
    playerId: string;
    reconnectDeadline: number;
  } | null {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.playerToRoom.delete(socketId);
      return null;
    }

    const player = room.players.get(socketId);
    if (!player) {
      this.playerToRoom.delete(socketId);
      return null;
    }

    player.connected = false;
    const reconnectDeadline = Date.now() + GAME_CONFIG.PLAYER_RECONNECT_GRACE_PERIOD;

    return {
      room,
      playerId: socketId,
      reconnectDeadline
    };
  }

  leaveRoom(socketId: string): {
    room: Room;
    playerId: string;
    roomDeleted: boolean;
    newHostId: string | null;
  } | null {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) {
      return null;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.playerToRoom.delete(socketId);
      return null;
    }

    const existing = room.players.get(socketId);
    if (!existing) {
      this.playerToRoom.delete(socketId);
      return null;
    }

    room.players.delete(socketId);
    this.playerToRoom.delete(socketId);

    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      return {
        room,
        playerId: socketId,
        roomDeleted: true,
        newHostId: null
      };
    }

    if (room.gameState.currentTurnPlayerId === socketId) {
      const [replacement] = room.players.values();
      room.gameState.currentTurnPlayerId = replacement.id;
    }
    if (room.gameState.buzzedPlayerId === socketId) {
      room.gameState.buzzedPlayerId = null;
    }
    if (room.gameState.dailyDoublePlayerId === socketId) {
      room.gameState.dailyDoublePlayerId = null;
    }

    let newHostId: string | null = null;
    if (room.hostId === socketId) {
      const connected = [...room.players.values()].find((player) => player.connected);
      const [fallback] = room.players.values();
      room.hostId = (connected ?? fallback).id;
      for (const player of room.players.values()) {
        player.isHost = player.id === room.hostId;
      }
      newHostId = room.hostId;
    }

    return {
      room,
      playerId: socketId,
      roomDeleted: false,
      newHostId
    };
  }

  getRoomByCode(roomCode: string): Room | null {
    return this.rooms.get(roomCode) ?? null;
  }

  getRoomForPlayer(socketId: string): Room | null {
    const roomCode = this.playerToRoom.get(socketId);
    if (!roomCode) {
      return null;
    }

    return this.rooms.get(roomCode) ?? null;
  }

  serializeRoom(room: Room): SerializedRoom {
    const board: BoardQuestionCell[][] = room.gameState.board.map((column) =>
      column.map((question) => ({
        id: question.id,
        category: question.category,
        value: question.value,
        question: question.question,
        options: question.options,
        dailyDouble: room.gameState.answeredQuestions.has(question.id)
          ? question.dailyDouble
          : false,
        answered: room.gameState.answeredQuestions.has(question.id)
      }))
    );

    return {
      id: room.id,
      code: room.code,
      config: room.config,
      hostId: room.hostId,
      players: [...room.players.values()],
      gameState: {
        board,
        phase: room.gameState.phase,
        currentTurnPlayerId: room.gameState.currentTurnPlayerId,
        selectedQuestion: room.gameState.selectedQuestion
          ? {
              id: room.gameState.selectedQuestion.id,
              category: room.gameState.selectedQuestion.category,
              value: room.gameState.selectedQuestion.value,
              question: room.gameState.selectedQuestion.question,
              options: room.gameState.selectedQuestion.options,
              dailyDouble: room.gameState.selectedQuestion.dailyDouble
            }
          : null,
        phaseEndsAt: room.gameState.phaseEndsAt,
        answeredQuestions: [...room.gameState.answeredQuestions],
        buzzedPlayerId: room.gameState.buzzedPlayerId,
        dailyDoubleWager: room.gameState.dailyDoubleWager,
        dailyDoublePlayerId: room.gameState.dailyDoublePlayerId
      },
      status: room.status,
      createdAt: room.createdAt,
      startedAt: room.startedAt
    };
  }

  getRoomCodeForPlayer(socketId: string): string | null {
    return this.playerToRoom.get(socketId) ?? null;
  }

  listRoomSummaries(): Array<{
    code: string;
    status: Room["status"];
    playerCount: number;
    connectedPlayerCount: number;
    createdAt: number;
    startedAt: number | null;
  }> {
    return [...this.rooms.values()]
      .map((room) => ({
        code: room.code,
        status: room.status,
        playerCount: room.players.size,
        connectedPlayerCount: [...room.players.values()].filter((player) => player.connected).length,
        createdAt: room.createdAt,
        startedAt: room.startedAt
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  private generateUniqueRoomCode(): string {
    let attempts = 0;
    while (attempts < 20) {
      const code = generateRoomCode();
      if (!this.rooms.has(code)) {
        return code;
      }
      attempts += 1;
    }

    return randomUUID().slice(0, GAME_CONFIG.ROOM_CODE_LENGTH).toUpperCase();
  }
}
