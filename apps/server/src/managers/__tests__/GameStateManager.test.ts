import assert from "node:assert/strict";
import test from "node:test";
import { GameStateManager } from "../GameStateManager.js";
import { RoomManager } from "../RoomManager.js";

const config = {
  categorySelection: "pack" as const,
  questionPack: "general",
  questionCount: 25 as const,
  timerSpeed: "standard" as const,
  dailyDoubleCount: 2 as const,
  finalJeopardyEnabled: true
};

const setupRoom = () => {
  const roomManager = new RoomManager();
  const gameStateManager = new GameStateManager();

  const room = roomManager.createRoom({
    socketId: "host-socket",
    userId: "host-user",
    userName: "Host",
    config
  });

  const joinResult = roomManager.joinRoom(room.code, {
    socketId: "p2-socket",
    userId: "p2-user",
    userName: "Player Two"
  });

  assert.ok(joinResult);
  gameStateManager.startGame(room);

  return { room, gameStateManager };
};

test("GameStateManager builds board from question packs", () => {
  const { room } = setupRoom();

  assert.equal(room.gameState.board.length, 5);
  assert.equal(room.gameState.board.every((column) => column.length === 5), true);
  assert.equal(
    room.gameState.board.every((column) =>
      column.map((question) => question.value).join(",") === "200,400,600,800,1000"
    ),
    true
  );

  const firstQuestion = room.gameState.board[0][0];
  assert.match(firstQuestion.id, /^q_\d+_\d+_/);
  assert.equal(firstQuestion.question.includes("for 200: clue"), false);

  const dailyDoubleCount = room.gameState.board
    .flat()
    .filter((question) => question.dailyDouble).length;
  assert.equal(dailyDoubleCount, room.config.dailyDoubleCount);
});

test("Daily Double unanswered question applies minimum wager penalty", () => {
  const { room, gameStateManager } = setupRoom();

  const hostId = room.hostId;
  room.gameState.currentTurnPlayerId = hostId;

  const dailyDouble = room.gameState.board.flat().find((question) => question.dailyDouble);
  assert.ok(dailyDouble);

  gameStateManager.selectQuestion(room, hostId, dailyDouble.id);
  gameStateManager.activateDailyDouble(room, hostId);

  const result = gameStateManager.submitAnswer(room, hostId, "");
  const host = room.players.get(hostId);

  assert.ok(host);
  assert.equal(result.result.correct, false);
  assert.equal(result.result.pointsAwarded, -200);
  assert.equal(host.score, -200);
  assert.equal(result.questionCompleted, true);
});

test("Selecting next question clears prior buzzer lockouts", () => {
  const { room, gameStateManager } = setupRoom();
  const hostId = room.hostId;
  const host = room.players.get(hostId);
  assert.ok(host);

  host.buzzerLocked = true;
  host.buzzerLockedUntil = Date.now() + 5_000;
  room.gameState.currentTurnPlayerId = hostId;

  const nextQuestion = room.gameState.board[0][0];
  gameStateManager.selectQuestion(room, hostId, nextQuestion.id);

  assert.equal(host.buzzerLocked, false);
  assert.equal(host.buzzerLockedUntil, 0);
});
