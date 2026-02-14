import type { GameResult, User, UserStats } from "@jeopardy/shared";

export interface UserRepository {
  createUser(id: string, name: string): User | Promise<User>;
  getUser(id: string): User | null | Promise<User | null>;
  updateUserName(id: string, name: string): void | User | null | Promise<void | User | null>;
}

export interface StatsRepository {
  getUserStats(userId: string): UserStats | Promise<UserStats>;
  recordGameCompletion?(gameResult: GameResult): void | Promise<void>;
}
