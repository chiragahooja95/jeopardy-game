import assert from "node:assert/strict";
import test from "node:test";
import { RoomManager } from "../RoomManager.js";

const baseConfig = {
  categorySelection: "random" as const,
  questionCount: 25 as const,
  timerSpeed: "standard" as const,
  dailyDoubleCount: 2 as const,
  finalJeopardyEnabled: true
};

test("RoomManager reconnects disconnected players by userId", () => {
  const roomManager = new RoomManager();

  const room = roomManager.createRoom({
    socketId: "host-socket",
    userId: "host-user",
    userName: "Host",
    config: baseConfig
  });

  const joined = roomManager.joinRoom(room.code, {
    socketId: "p2-socket",
    userId: "p2-user",
    userName: "Player Two"
  });

  assert.ok(joined);
  room.status = "playing";
  room.hostId = "p2-socket";
  room.gameState.currentTurnPlayerId = "p2-socket";
  room.gameState.buzzedPlayerId = "p2-socket";
  room.gameState.dailyDoublePlayerId = "p2-socket";

  const disconnected = roomManager.disconnectPlayer("p2-socket");
  assert.ok(disconnected);
  assert.equal(room.players.get("p2-socket")?.connected, false);

  const rejoined = roomManager.joinRoom(room.code, {
    socketId: "p2-new-socket",
    userId: "p2-user",
    userName: "Player Two"
  });

  assert.ok(rejoined);
  assert.equal(rejoined.reconnected, true);
  assert.equal(rejoined.previousPlayerId, "p2-socket");
  assert.equal(room.players.has("p2-socket"), false);
  assert.equal(room.players.has("p2-new-socket"), true);
  assert.equal(room.hostId, "p2-new-socket");
  assert.equal(room.gameState.currentTurnPlayerId, "p2-new-socket");
  assert.equal(room.gameState.buzzedPlayerId, "p2-new-socket");
  assert.equal(room.gameState.dailyDoublePlayerId, "p2-new-socket");
});
