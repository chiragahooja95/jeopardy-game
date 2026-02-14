// Game Configuration Constants
// Shared between client and server

export const GAME_CONFIG = {
  // Player Limits
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,

  // Board Configuration
  CATEGORIES_COUNT: 5,
  QUESTIONS_PER_CATEGORY: 5,
  QUESTION_VALUES: [200, 400, 600, 800, 1000] as const,

  // Quick game mode
  QUICK_CATEGORIES_COUNT: 3,
  QUICK_QUESTIONS_PER_CATEGORY: 5,

  // Daily Doubles
  MIN_DAILY_DOUBLES: 1,
  MAX_DAILY_DOUBLES: 3,
  DEFAULT_DAILY_DOUBLES: 2,

  // Timing (milliseconds) - Standard Mode
  READING_PHASE_DURATION: 5000, // 5 seconds
  BUZZER_TIMEOUT: 15000, // 15 seconds (if no one buzzes)
  ANSWER_WINDOW: 10000, // 10 seconds
  BUZZER_LOCKOUT_DURATION: 2000, // 2 seconds
  DAILY_DOUBLE_ANSWER_TIME: 15000, // 15 seconds
  FINAL_JEOPARDY_WAGER_TIME: 30000, // 30 seconds
  FINAL_JEOPARDY_ANSWER_TIME: 60000, // 60 seconds
  FINAL_JEOPARDY_REVEAL_DELAY: 3000, // 3 seconds between each reveal

  // Timing - Fast Mode (halved)
  FAST_READING_PHASE_DURATION: 2500,
  FAST_BUZZER_TIMEOUT: 7500,
  FAST_ANSWER_WINDOW: 5000,
  FAST_BUZZER_LOCKOUT_DURATION: 1000,
  FAST_DAILY_DOUBLE_ANSWER_TIME: 7500,
  FAST_FINAL_JEOPARDY_WAGER_TIME: 15000,
  FAST_FINAL_JEOPARDY_ANSWER_TIME: 30000,
  FAST_FINAL_JEOPARDY_REVEAL_DELAY: 1500,

  // Scoring
  MIN_DAILY_DOUBLE_WAGER: 200,
  MIN_FINAL_JEOPARDY_WAGER: 0,
  NEGATIVE_SCORE_DAILY_DOUBLE_WAGER: 200,
  NEGATIVE_SCORE_FINAL_JEOPARDY_MAX: 1000,

  // Room
  ROOM_CODE_LENGTH: 4,
  ROOM_CLEANUP_TIMEOUT: 3600000, // 1 hour of inactivity
  PLAYER_RECONNECT_GRACE_PERIOD: 30000, // 30 seconds

  // Server
  SERVER_TICK_RATE: 30, // 30 ticks per second
  STATE_BROADCAST_RATE: 10, // 10 broadcasts per second
  MAX_BUZZER_ATTEMPTS_PER_SECOND: 10, // Rate limiting

  // Question Packs
  AVAILABLE_PACKS: ['general', 'science', 'history'] as const,

  // Default Categories (always selected unless room owner changes)
  DEFAULT_CATEGORIES: ['Bollywood', 'Baby Questions'] as const,
} as const;

// Helper function to get timing based on speed mode
export function getGameTiming(speed: 'standard' | 'fast') {
  if (speed === 'fast') {
    return {
      readingPhase: GAME_CONFIG.FAST_READING_PHASE_DURATION,
      buzzerTimeout: GAME_CONFIG.FAST_BUZZER_TIMEOUT,
      answerWindow: GAME_CONFIG.FAST_ANSWER_WINDOW,
      buzzerLockout: GAME_CONFIG.FAST_BUZZER_LOCKOUT_DURATION,
      dailyDoubleAnswer: GAME_CONFIG.FAST_DAILY_DOUBLE_ANSWER_TIME,
      finalJeopardyWager: GAME_CONFIG.FAST_FINAL_JEOPARDY_WAGER_TIME,
      finalJeopardyAnswer: GAME_CONFIG.FAST_FINAL_JEOPARDY_ANSWER_TIME,
      finalJeopardyReveal: GAME_CONFIG.FAST_FINAL_JEOPARDY_REVEAL_DELAY,
    };
  }

  return {
    readingPhase: GAME_CONFIG.READING_PHASE_DURATION,
    buzzerTimeout: GAME_CONFIG.BUZZER_TIMEOUT,
    answerWindow: GAME_CONFIG.ANSWER_WINDOW,
    buzzerLockout: GAME_CONFIG.BUZZER_LOCKOUT_DURATION,
    dailyDoubleAnswer: GAME_CONFIG.DAILY_DOUBLE_ANSWER_TIME,
    finalJeopardyWager: GAME_CONFIG.FINAL_JEOPARDY_WAGER_TIME,
    finalJeopardyAnswer: GAME_CONFIG.FINAL_JEOPARDY_ANSWER_TIME,
    finalJeopardyReveal: GAME_CONFIG.FINAL_JEOPARDY_REVEAL_DELAY,
  };
}

// Helper function to calculate Daily Double wager limits
export function getDailyDoubleWagerLimits(playerScore: number, questionValue: number = 1000): { min: number; max: number } {
  const min = GAME_CONFIG.MIN_DAILY_DOUBLE_WAGER;
  const max = Math.max(playerScore, questionValue, GAME_CONFIG.NEGATIVE_SCORE_DAILY_DOUBLE_WAGER);

  return { min, max };
}

// Helper function to calculate Final Jeopardy wager limits
export function getFinalJeopardyWagerLimits(playerScore: number): { min: number; max: number } {
  const min = GAME_CONFIG.MIN_FINAL_JEOPARDY_WAGER;
  const max = playerScore > 0 ? playerScore : GAME_CONFIG.NEGATIVE_SCORE_FINAL_JEOPARDY_MAX;

  return { min, max };
}
