import express from "express";
import {
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData
} from "@jeopardy/shared";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { initDatabase, closeDatabase } from "./database/db.js";
import { StatsRepository } from "./database/repositories/StatsRepository.js";
import { UserRepository } from "./database/repositories/UserRepository.js";
import { registerGameHandlers } from "./handlers/gameHandler.js";
import { registerUserHandlers } from "./handlers/userHandler.js";
import { BuzzerManager } from "./managers/BuzzerManager.js";
import { FinalJeopardyManager } from "./managers/FinalJeopardyManager.js";
import { GameStateManager } from "./managers/GameStateManager.js";
import { RoomManager } from "./managers/RoomManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

initDatabase();

const app = express();
const server = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: "*"
  }
});

const userRepository = new UserRepository();
const statsRepository = new StatsRepository();
const roomManager = new RoomManager();
const gameStateManager = new GameStateManager();
const buzzerManager = new BuzzerManager();
const finalJeopardyManager = new FinalJeopardyManager();

io.on("connection", (socket) => {
  registerUserHandlers(socket, { userRepository, statsRepository });
  registerGameHandlers(socket, {
    io,
    roomManager,
    gameStateManager,
    buzzerManager,
    finalJeopardyManager,
    statsRepository
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const clientDistPath = join(__dirname, "../../client/dist");
const clientIndexPath = join(clientDistPath, "index.html");

if (existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/health") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }

    res.sendFile(clientIndexPath);
  });
} else {
  console.warn(`[Server] Client build not found at ${clientIndexPath}`);
}

const shutdown = () => {
  closeDatabase();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
