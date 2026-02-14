import {
  getFinalJeopardyWagerLimits,
  getGameTiming,
  fuzzyAnswerMatch,
  type FinalJeopardyQuestion,
  type FinalJeopardyReveal,
  type GameResult,
  type Player,
  type Room
} from "@jeopardy/shared";

const FINAL_JEOPARDY_QUESTIONS: FinalJeopardyQuestion[] = [
  {
    category: "Science",
    question: "This element has the atomic number 1.",
    answer: "Hydrogen"
  },
  {
    category: "History",
    question: "This empire was ruled by Julius Caesar before becoming an empire.",
    answer: "Roman Republic"
  },
  {
    category: "Geography",
    question: "This is the longest river in Africa.",
    answer: "Nile"
  },
  {
    category: "Literature",
    question: "This playwright wrote Hamlet.",
    answer: "Shakespeare"
  }
];

interface FinalJeopardyState {
  question: FinalJeopardyQuestion;
  wagers: Map<string, number>;
  answers: Map<string, string>;
  wagerEndsAt: number;
  answerEndsAt: number | null;
}

interface FinalResult {
  correctAnswer: string;
  winner: Player;
  reveals: FinalJeopardyReveal[];
  gameResult: GameResult;
}

const chooseQuestion = (): FinalJeopardyQuestion =>
  FINAL_JEOPARDY_QUESTIONS[Math.floor(Math.random() * FINAL_JEOPARDY_QUESTIONS.length)];

export class FinalJeopardyManager {
  private readonly roomState = new Map<string, FinalJeopardyState>();

  startFinalJeopardy(room: Room): { category: string; wagerEndsAt: number } {
    const timing = getGameTiming(room.config.timerSpeed);
    const question = chooseQuestion();
    const wagerEndsAt = Date.now() + timing.finalJeopardyWager;

    this.roomState.set(room.code, {
      question,
      wagers: new Map(),
      answers: new Map(),
      wagerEndsAt,
      answerEndsAt: null
    });

    room.status = "final_jeopardy";
    room.gameState.phase = "final_jeopardy_wager";
    room.gameState.phaseEndsAt = wagerEndsAt;

    return {
      category: question.category,
      wagerEndsAt
    };
  }

  getWagerLimits(room: Room): Array<{ playerId: string; minWager: number; maxWager: number; currentScore: number }> {
    return [...room.players.values()].map((player) => {
      const limits = getFinalJeopardyWagerLimits(player.score);
      return {
        playerId: player.id,
        minWager: limits.min,
        maxWager: limits.max,
        currentScore: player.score
      };
    });
  }

  submitWager(room: Room, playerId: string, wager: number): { allWagersSubmitted: boolean } {
    const state = this.getState(room.code);
    if (room.gameState.phase !== "final_jeopardy_wager") {
      throw new Error("Not in Final Jeopardy wager phase.");
    }

    const player = room.players.get(playerId);
    if (!player) {
      throw new Error("Player not found.");
    }

    const { min, max } = getFinalJeopardyWagerLimits(player.score);
    if (!Number.isInteger(wager) || wager < min || wager > max) {
      throw new Error("Invalid Final Jeopardy wager.");
    }

    state.wagers.set(playerId, wager);

    return {
      allWagersSubmitted: state.wagers.size >= room.players.size
    };
  }

  startAnswerPhase(room: Room): { category: string; question: string; answerEndsAt: number } {
    const state = this.getState(room.code);
    const timing = getGameTiming(room.config.timerSpeed);
    const answerEndsAt = Date.now() + timing.finalJeopardyAnswer;

    state.answerEndsAt = answerEndsAt;
    room.gameState.phase = "final_jeopardy_answer";
    room.gameState.phaseEndsAt = answerEndsAt;

    return {
      category: state.question.category,
      question: state.question.question,
      answerEndsAt
    };
  }

  submitAnswer(room: Room, playerId: string, answer: string): { allAnswersSubmitted: boolean } {
    const state = this.getState(room.code);
    if (room.gameState.phase !== "final_jeopardy_answer") {
      throw new Error("Not in Final Jeopardy answer phase.");
    }

    if (!room.players.has(playerId)) {
      throw new Error("Player not found.");
    }

    state.answers.set(playerId, answer.trim());

    return {
      allAnswersSubmitted: state.answers.size >= room.players.size
    };
  }

  finalize(room: Room): FinalResult {
    const state = this.getState(room.code);

    room.gameState.phase = "final_jeopardy_reveal";
    room.gameState.phaseEndsAt = Date.now();

    const finalCorrectByUser = new Map<string, number>();
    const reveals: FinalJeopardyReveal[] = [];

    for (const player of room.players.values()) {
      const wager = state.wagers.get(player.id) ?? 0;
      const answer = state.answers.get(player.id) ?? "";
      const correct = fuzzyAnswerMatch(answer, state.question.answer);

      player.score += correct ? wager : -wager;
      finalCorrectByUser.set(player.userId, correct ? 1 : 0);

      reveals.push({
        playerId: player.id,
        playerName: player.name,
        wager,
        answer,
        correct,
        scoreAfter: player.score
      });
    }

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
        finalJeopardyCorrect: finalCorrectByUser.get(player.userId) ?? 0
      }))
    };

    room.status = "finished";

    return {
      correctAnswer: state.question.answer,
      winner,
      reveals,
      gameResult
    };
  }

  clear(roomCode: string): void {
    this.roomState.delete(roomCode);
  }

  private getState(roomCode: string): FinalJeopardyState {
    const state = this.roomState.get(roomCode);
    if (!state) {
      throw new Error("Final Jeopardy state not initialized for room.");
    }

    return state;
  }
}
