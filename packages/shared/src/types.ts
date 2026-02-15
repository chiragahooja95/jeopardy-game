export interface User {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  totalPoints: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracyRate: number;
  totalBuzzerAttempts: number;
  totalBuzzerWins: number;
  buzzerWinRate: number;
  dailyDoublesCorrect: number;
  finalJeopardyCorrect: number;
  currentStreak: number;
  bestStreak: number;
}

export const createEmptyUserStats = (userId: string = ""): UserStats => ({
  userId,
  gamesPlayed: 0,
  gamesWon: 0,
  winRate: 0,
  totalPoints: 0,
  averageScore: 0,
  highestScore: 0,
  lowestScore: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  accuracyRate: 0,
  totalBuzzerAttempts: 0,
  totalBuzzerWins: 0,
  buzzerWinRate: 0,
  dailyDoublesCorrect: 0,
  finalJeopardyCorrect: 0,
  currentStreak: 0,
  bestStreak: 0
});

export interface RoomConfig {
  categorySelection: "random" | "true_random" | "manual" | "pack";
  selectedCategories?: string[];
  questionPack?: string;
  questionCount: 25 | 15;
  timerSpeed: "standard" | "fast";
  dailyDoubleCount: 1 | 2 | 3;
  finalJeopardyEnabled: boolean;
}

export interface Question {
  id: string;
  category: string;
  value: number;
  question: string;
  answer: string;
  options?: string[];
  dailyDouble: boolean;
}

export type PublicQuestion = Omit<Question, "answer">;

export const toPublicQuestion = (question: Question): PublicQuestion => ({
  id: question.id,
  category: question.category,
  value: question.value,
  question: question.question,
  options: question.options,
  dailyDouble: question.dailyDouble
});

export interface BoardQuestionCell extends PublicQuestion {
  answered: boolean;
}

export type GamePhase =
  | "selection"
  | "reading"
  | "buzzer_active"
  | "answering"
  | "daily_double"
  | "final_jeopardy_wager"
  | "final_jeopardy_answer"
  | "final_jeopardy_reveal";

export type RoomStatus = "lobby" | "playing" | "final_jeopardy" | "finished";

export interface Player {
  id: string;
  userId: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  buzzerLocked: boolean;
  buzzerLockedUntil: number;
  correctAnswers: number;
  wrongAnswers: number;
  buzzerAttempts: number;
  buzzerWins: number;
  dailyDoubleCorrect: number;
  dailyDoubleWrong: number;
}

export interface QuestionAttempt {
  playerId: string;
  playerName: string;
  answer: string;
  correct: boolean;
  pointsAwarded: number;
}

export interface GameState {
  board: Question[][];
  phase: GamePhase;
  currentTurnPlayerId: string;
  selectedQuestion: Question | null;
  phaseEndsAt: number | null;
  answeredQuestions: Set<string>;
  buzzedPlayerId: string | null;
  dailyDoubleWager: number | null;
  dailyDoublePlayerId: string | null;
  questionAttempts: QuestionAttempt[];
}

export interface Room {
  id: string;
  code: string;
  config: RoomConfig;
  hostId: string;
  players: Map<string, Player>;
  gameState: GameState;
  status: RoomStatus;
  createdAt: number;
  startedAt: number | null;
}

export interface SerializedGameState {
  board: BoardQuestionCell[][];
  phase: GamePhase;
  currentTurnPlayerId: string;
  selectedQuestion: PublicQuestion | null;
  phaseEndsAt: number | null;
  answeredQuestions: string[];
  buzzedPlayerId: string | null;
  dailyDoubleWager: number | null;
  dailyDoublePlayerId: string | null;
  questionAttempts: QuestionAttempt[];
}

export interface SerializedRoom {
  id: string;
  code: string;
  config: RoomConfig;
  hostId: string;
  players: Player[];
  gameState: SerializedGameState;
  status: RoomStatus;
  createdAt: number;
  startedAt: number | null;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string | null;
  playerAnswer: string;
  pointsAwarded: number;
  newScore: number;
}

export interface PlayerGameStats {
  userId: string;
  finalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  buzzerAttempts: number;
  buzzerWins: number;
  dailyDoubleCorrect: number;
  dailyDoubleWrong: number;
  finalJeopardyCorrect: number;
  placement: number;
}

export interface GameResult {
  roomCode: string;
  players: PlayerGameStats[];
  winnerId: string;
  startedAt: number;
  endedAt: number;
}

export interface FinalJeopardyQuestion {
  category: string;
  question: string;
  answer: string;
}

export interface FinalJeopardyReveal {
  playerId: string;
  playerName: string;
  wager: number;
  answer: string;
  correct: boolean;
  scoreAfter: number;
}

export interface CreateUserPayload {
  userId: string;
  name: string;
}

export interface GetUserStatsPayload {
  userId: string;
}

export interface UserCreatedPayload {
  user: User;
}

export interface UserStatsPayload {
  stats: UserStats;
}

export interface ServerErrorPayload {
  message: string;
}
