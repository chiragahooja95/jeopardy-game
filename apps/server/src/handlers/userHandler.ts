import { CLIENT_EVENTS, SERVER_EVENTS, type ClientToServerEvents, type ServerToClientEvents } from "@jeopardy/shared";
import type { Socket } from "socket.io";
import type { StatsRepository, UserRepository } from "../database/repositories/contracts.js";

interface UserHandlerDeps {
  userRepository: UserRepository;
  statsRepository: StatsRepository;
}

const isValidText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const emitError = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  message: string
) => {
  socket.emit(SERVER_EVENTS.ERROR, { message });
};

export const registerUserHandlers = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  { userRepository, statsRepository }: UserHandlerDeps
) => {
  socket.on(CLIENT_EVENTS.CREATE_USER, async (payload) => {
    if (!payload || !isValidText(payload.userId) || !isValidText(payload.name)) {
      emitError(socket, "Invalid CREATE_USER payload");
      return;
    }

    const userId = payload.userId.trim();
    const userName = payload.name.trim();

    try {
      const existing = await userRepository.getUser(userId);
      if (existing) {
        await userRepository.updateUserName(userId, userName);
        const updatedUser = await userRepository.getUser(userId);
        if (updatedUser) {
          socket.emit(SERVER_EVENTS.USER_CREATED, { user: updatedUser });
        }
        return;
      }

      const createdUser = await userRepository.createUser(userId, userName);
      socket.emit(SERVER_EVENTS.USER_CREATED, { user: createdUser });
    } catch {
      emitError(socket, "Failed to create or update user");
    }
  });

  socket.on(CLIENT_EVENTS.GET_USER_STATS, async (payload) => {
    if (!payload || !isValidText(payload.userId)) {
      emitError(socket, "Invalid GET_USER_STATS payload");
      return;
    }

    try {
      const stats = await statsRepository.getUserStats(payload.userId.trim());
      socket.emit(SERVER_EVENTS.USER_STATS, { stats });
    } catch {
      emitError(socket, "Failed to fetch user stats");
    }
  });
};
