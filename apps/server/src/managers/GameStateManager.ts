import {
  GAME_CONFIG,
  getDailyDoubleWagerLimits,
  getGameTiming,
  fuzzyAnswerMatch,
  validateDailyDoubleWager,
  type AnswerResult,
  type GameResult,
  type Player,
  type Question,
  type Room
} from "@jeopardy/shared";
import { QuestionPackManager } from "./QuestionPackManager.js";

export interface SelectQuestionResult {
  question: Question;
  phaseEndsAt: number;
  isDailyDouble: boolean;
  dailyDoubleLimits: { min: number; max: number } | null;
}

export interface SubmitAnswerResult {
  result: AnswerResult;
  nextTurnPlayerId: string;
  questionCompleted: boolean;
  completedQuestionId: string | null;
  completedCorrectAnswer: string | null;
}

export class GameStateManager {
  private readonly questionPackManager: QuestionPackManager;

  constructor(questionPackManager: QuestionPackManager = new QuestionPackManager()) {
    this.questionPackManager = questionPackManager;
  }

  startGame(room: Room): void {
    const players = [...room.players.values()].filter((player) => player.connected);
    if (players.length < GAME_CONFIG.MIN_PLAYERS) {
      throw new Error("At least two players are required to start.");
    }

    const validation = this.questionPackManager.validateConfig(room.config);
    if (!validation.valid) {
      throw new Error(validation.error ?? "Invalid room configuration.");
    }

    room.gameState.board = this.buildBoard(room);
    room.gameState.phase = "selection";
    room.gameState.phaseEndsAt = null;
    room.gameState.selectedQuestion = null;
    room.gameState.answeredQuestions.clear();
    room.gameState.buzzedPlayerId = null;
    room.gameState.dailyDoublePlayerId = null;
    room.gameState.dailyDoubleWager = null;

    const firstPlayer = players[Math.floor(Math.random() * players.length)];
    room.gameState.currentTurnPlayerId = firstPlayer.id;
    room.status = "playing";
    room.startedAt = Date.now();

    for (const player of room.players.values()) {
      player.score = 0;
      player.correctAnswers = 0;
      player.wrongAnswers = 0;
      player.buzzerAttempts = 0;
      player.buzzerWins = 0;
      player.dailyDoubleCorrect = 0;
      player.dailyDoubleWrong = 0;
      player.buzzerLocked = false;
      player.buzzerLockedUntil = 0;
    }
  }

  selectQuestion(room: Room, playerId: string, questionId: string): SelectQuestionResult {
    if (room.status !== "playing") {
      throw new Error("Game has not started.");
    }
    if (room.gameState.phase !== "selection") {
      throw new Error("Question selection is not currently allowed.");
    }
    if (room.gameState.currentTurnPlayerId !== playerId) {
      throw new Error("It is not your turn to select a question.");
    }

    const question = this.getQuestionById(room, questionId);
    if (!question) {
      throw new Error("Question not found.");
    }

    if (room.gameState.answeredQuestions.has(questionId)) {
      throw new Error("Question has already been answered.");
    }

    this.clearBuzzerLocks(room);

    const timing = getGameTiming(room.config.timerSpeed);
    room.gameState.selectedQuestion = question;
    room.gameState.buzzedPlayerId = null;
    room.gameState.dailyDoubleWager = null;
    room.gameState.dailyDoublePlayerId = null;
    room.gameState.phase = "reading";
    room.gameState.phaseEndsAt = Date.now() + timing.readingPhase;

    const limits = question.dailyDouble
      ? getDailyDoubleWagerLimits(room.players.get(playerId)?.score ?? 0, question.value)
      : null;

    return {
      question,
      phaseEndsAt: room.gameState.phaseEndsAt,
      isDailyDouble: question.dailyDouble,
      dailyDoubleLimits: limits
    };
  }

  activateBuzzer(room: Room): number {
    const timing = getGameTiming(room.config.timerSpeed);
    room.gameState.phase = "buzzer_active";
    room.gameState.phaseEndsAt = Date.now() + timing.buzzerTimeout;
    room.gameState.buzzedPlayerId = null;
    return room.gameState.phaseEndsAt;
  }

  activateDailyDouble(room: Room, playerId: string): { phaseEndsAt: number | null; min: number; max: number } {
    const question = room.gameState.selectedQuestion;
    if (!question || !question.dailyDouble) {
      throw new Error("Selected question is not a Daily Double.");
    }

    const score = room.players.get(playerId)?.score ?? 0;
    const limits = getDailyDoubleWagerLimits(score, question.value);

    room.gameState.phase = "daily_double";
    room.gameState.phaseEndsAt = null;
    room.gameState.dailyDoublePlayerId = playerId;

    return { phaseEndsAt: room.gameState.phaseEndsAt, min: limits.min, max: limits.max };
  }

  submitDailyDoubleWager(room: Room, playerId: string, wager: number): void {
    const question = room.gameState.selectedQuestion;
    const expectedPlayer = room.gameState.dailyDoublePlayerId;

    if (!question || !question.dailyDouble || room.gameState.phase !== "daily_double") {
      throw new Error("Not in Daily Double phase.");
    }

    if (playerId !== expectedPlayer) {
      throw new Error("Only the selecting player can submit Daily Double wager.");
    }

    if (room.gameState.dailyDoubleWager !== null) {
      throw new Error("Daily Double wager has already been submitted.");
    }

    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found.");
    }

    if (!validateDailyDoubleWager(wager, player.score, question.value)) {
      throw new Error("Invalid Daily Double wager.");
    }

    room.gameState.dailyDoubleWager = wager;
  }

  startDailyDoubleAnswerWindow(room: Room): number {
    if (room.gameState.phase !== "daily_double") {
      throw new Error("Not in Daily Double phase.");
    }
    if (room.gameState.dailyDoublePlayerId === null) {
      throw new Error("No Daily Double player found.");
    }
    if (room.gameState.dailyDoubleWager === null) {
      throw new Error("Daily Double wager must be submitted first.");
    }

    const timing = getGameTiming(room.config.timerSpeed);
    room.gameState.phaseEndsAt = Date.now() + timing.dailyDoubleAnswer;
    return room.gameState.phaseEndsAt;
  }

  ensureDailyDoubleWager(room: Room, playerId: string): number {
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found.");
    }

    if (room.gameState.dailyDoubleWager !== null) {
      return room.gameState.dailyDoubleWager;
    }

    const question = room.gameState.selectedQuestion;
    if (!question) {
      throw new Error("No active question.");
    }

    const limits = getDailyDoubleWagerLimits(player.score, question.value);
    room.gameState.dailyDoubleWager = limits.min;
    return limits.min;
  }

  setBuzzWinner(room: Room, playerId: string): number {
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found.");
    }

    const timing = getGameTiming(room.config.timerSpeed);
    room.gameState.phase = "answering";
    room.gameState.phaseEndsAt = Date.now() + timing.answerWindow;
    room.gameState.buzzedPlayerId = playerId;
    player.buzzerWins += 1;

    return room.gameState.phaseEndsAt;
  }

  submitAnswer(room: Room, playerId: string, answer: string): SubmitAnswerResult {
    const question = room.gameState.selectedQuestion;
    if (!question) {
      throw new Error("No question selected.");
    }

    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found.");
    }

    const isDailyDouble = room.gameState.phase === "daily_double";
    const isRegularAnswer = room.gameState.phase === "answering";

    if (!isDailyDouble && !isRegularAnswer) {
      throw new Error("Answering is not currently allowed.");
    }

    if (isRegularAnswer && room.gameState.buzzedPlayerId !== playerId) {
      throw new Error("Only the buzzed player can answer.");
    }

    if (isDailyDouble && room.gameState.dailyDoublePlayerId !== playerId) {
      throw new Error("Only the Daily Double player can answer.");
    }

    const value = isDailyDouble
      ? this.ensureDailyDoubleWager(room, playerId)
      : question.value;
    const correct = fuzzyAnswerMatch(answer, question.answer);
    const signedPoints = correct ? value : -value;

    player.score += signedPoints;
    if (correct) {
      player.correctAnswers += 1;
      if (isDailyDouble) {
        player.dailyDoubleCorrect += 1;
      }
    } else {
      player.wrongAnswers += 1;
      if (isDailyDouble) {
        player.dailyDoubleWrong += 1;
      }
    }

    const result: AnswerResult = {
      correct,
      correctAnswer: correct || isDailyDouble ? question.answer : null,
      playerAnswer: answer,
      pointsAwarded: signedPoints,
      newScore: player.score
    };

    if (correct || isDailyDouble) {
      const completion = this.completeCurrentQuestion(
        room,
        correct ? playerId : room.gameState.currentTurnPlayerId
      );
      return {
        result,
        nextTurnPlayerId: room.gameState.currentTurnPlayerId,
        questionCompleted: true,
        completedQuestionId: completion.questionId,
        completedCorrectAnswer: completion.correctAnswer
      };
    }

    room.gameState.phase = "buzzer_active";
    room.gameState.phaseEndsAt = Date.now() + getGameTiming(room.config.timerSpeed).buzzerTimeout;
    room.gameState.buzzedPlayerId = null;

    return {
      result,
      nextTurnPlayerId: room.gameState.currentTurnPlayerId,
      questionCompleted: false,
      completedQuestionId: null,
      completedCorrectAnswer: null
    };
  }

  completeQuestionNoAnswer(room: Room): { questionId: string; correctAnswer: string } {
    const question = room.gameState.selectedQuestion;
    if (!question) {
      throw new Error("No active question.");
    }

    const questionId = question.id;
    const correctAnswer = question.answer;

    room.gameState.answeredQuestions.add(question.id);
    room.gameState.selectedQuestion = null;
    room.gameState.phase = "selection";
    room.gameState.phaseEndsAt = null;
    room.gameState.buzzedPlayerId = null;
    room.gameState.dailyDoublePlayerId = null;
    room.gameState.dailyDoubleWager = null;

    return { questionId, correctAnswer };
  }

  isGameComplete(room: Room): boolean {
    const totalQuestions = room.gameState.board.reduce((count, column) => count + column.length, 0);
    return room.gameState.answeredQuestions.size >= totalQuestions;
  }

  createGameResult(room: Room): { winner: Player; result: GameResult } {
    const sortedPlayers = [...room.players.values()].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    const gameResult: GameResult = {
      roomCode: room.code,
      winnerId: winner.userId,
      startedAt: room.startedAt ?? Date.now(),
      endedAt: Date.now(),
      players: sortedPlayers.map((player, index) => ({
        userId: player.userId,
        finalScore: player.score,
        placement: index + 1,
        correctAnswers: player.correctAnswers,
        wrongAnswers: player.wrongAnswers,
        buzzerAttempts: player.buzzerAttempts,
        buzzerWins: player.buzzerWins,
        dailyDoubleCorrect: player.dailyDoubleCorrect,
        dailyDoubleWrong: player.dailyDoubleWrong,
        finalJeopardyCorrect: 0
      }))
    };

    return { winner, result: gameResult };
  }

  private completeCurrentQuestion(
    room: Room,
    nextTurnPlayerId: string
  ): { questionId: string; correctAnswer: string } {
    if (!room.gameState.selectedQuestion) {
      throw new Error("No active question.");
    }

    const questionId = room.gameState.selectedQuestion.id;
    const correctAnswer = room.gameState.selectedQuestion.answer;
    room.gameState.answeredQuestions.add(questionId);
    room.gameState.selectedQuestion = null;
    room.gameState.phase = "selection";
    room.gameState.phaseEndsAt = null;
    room.gameState.currentTurnPlayerId = nextTurnPlayerId;
    room.gameState.buzzedPlayerId = null;
    room.gameState.dailyDoublePlayerId = null;
    room.gameState.dailyDoubleWager = null;
    return { questionId, correctAnswer };
  }

  private buildBoard(room: Room): Question[][] {
    return this.questionPackManager.generateBoard(room.config);
  }

  private clearBuzzerLocks(room: Room): void {
    for (const player of room.players.values()) {
      player.buzzerLocked = false;
      player.buzzerLockedUntil = 0;
    }
  }

  private getQuestionById(room: Room, questionId: string): Question | null {
    for (const column of room.gameState.board) {
      for (const question of column) {
        if (question.id === questionId) {
          return question;
        }
      }
    }

    return null;
  }
}
