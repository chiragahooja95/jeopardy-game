import { GAME_CONFIG } from "@jeopardy/shared";

interface RoomBuzzerState {
  buzzerLocked: boolean;
  lockouts: Map<string, number>;
  attemptsByPlayerSecond: Map<string, { second: number; count: number }>;
}

export class BuzzerManager {
  private readonly roomState = new Map<string, RoomBuzzerState>();

  prepareForQuestion(roomCode: string): void {
    this.roomState.set(roomCode, {
      buzzerLocked: false,
      lockouts: new Map(),
      attemptsByPlayerSecond: new Map()
    });
  }

  handleBuzz(roomCode: string, playerId: string): string | null {
    const state = this.ensureRoomState(roomCode);
    this.pruneExpiredLocks(state);

    if (state.buzzerLocked || this.isPlayerLocked(roomCode, playerId)) {
      return null;
    }

    if (!this.consumeAttempt(state, playerId)) {
      return null;
    }

    state.buzzerLocked = true;
    return playerId;
  }

  lockPlayer(roomCode: string, playerId: string, durationMs: number): number {
    const state = this.ensureRoomState(roomCode);
    const lockedUntil = Date.now() + durationMs;
    state.lockouts.set(playerId, lockedUntil);
    return lockedUntil;
  }

  isPlayerLocked(roomCode: string, playerId: string): boolean {
    const state = this.ensureRoomState(roomCode);
    const until = state.lockouts.get(playerId);
    if (!until) {
      return false;
    }

    if (until <= Date.now()) {
      state.lockouts.delete(playerId);
      return false;
    }

    return true;
  }

  getPlayerLockout(roomCode: string, playerId: string): number {
    const state = this.ensureRoomState(roomCode);
    const until = state.lockouts.get(playerId);
    if (!until) {
      return 0;
    }
    if (until <= Date.now()) {
      state.lockouts.delete(playerId);
      return 0;
    }
    return until;
  }

  unlockBuzzer(roomCode: string): void {
    this.ensureRoomState(roomCode).buzzerLocked = false;
  }

  reset(roomCode: string): void {
    this.roomState.delete(roomCode);
  }

  private ensureRoomState(roomCode: string): RoomBuzzerState {
    const existing = this.roomState.get(roomCode);
    if (existing) {
      return existing;
    }

    const created: RoomBuzzerState = {
      buzzerLocked: false,
      lockouts: new Map(),
      attemptsByPlayerSecond: new Map()
    };

    this.roomState.set(roomCode, created);
    return created;
  }

  private consumeAttempt(state: RoomBuzzerState, playerId: string): boolean {
    const second = Math.floor(Date.now() / 1000);
    const existing = state.attemptsByPlayerSecond.get(playerId);

    if (!existing || existing.second !== second) {
      state.attemptsByPlayerSecond.set(playerId, { second, count: 1 });
      return true;
    }

    if (existing.count >= GAME_CONFIG.MAX_BUZZER_ATTEMPTS_PER_SECOND) {
      return false;
    }

    existing.count += 1;
    return true;
  }

  private pruneExpiredLocks(state: RoomBuzzerState): void {
    const now = Date.now();
    for (const [playerId, lockedUntil] of state.lockouts) {
      if (lockedUntil <= now) {
        state.lockouts.delete(playerId);
      }
    }
  }
}
