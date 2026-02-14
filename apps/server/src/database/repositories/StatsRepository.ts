// Stats Repository
// Handles statistics queries and game completion persistence.

import { randomUUID } from 'node:crypto';
import type { GameResult, UserStats } from '@jeopardy/shared';
import { createEmptyUserStats } from '@jeopardy/shared';
import { getDatabase, runInTransaction } from '../db.js';

interface StatsRow {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  highestScore: number;
  lowestScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalBuzzerAttempts: number;
  totalBuzzerWins: number;
  dailyDoublesCorrect: number;
  finalJeopardyCorrect: number;
  currentStreak: number;
  bestStreak: number;
}

const withDerivedRates = (row: StatsRow): UserStats => {
  const totalAnswers = row.correctAnswers + row.wrongAnswers;

  return {
    ...row,
    winRate: row.gamesPlayed > 0 ? (row.gamesWon / row.gamesPlayed) * 100 : 0,
    averageScore: row.gamesPlayed > 0 ? row.totalPoints / row.gamesPlayed : 0,
    accuracyRate: totalAnswers > 0 ? (row.correctAnswers / totalAnswers) * 100 : 0,
    buzzerWinRate:
      row.totalBuzzerAttempts > 0
        ? (row.totalBuzzerWins / row.totalBuzzerAttempts) * 100
        : 0
  };
};

export class StatsRepository {
  getUserStats(userId: string): UserStats {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT
        user_id as userId,
        games_played as gamesPlayed,
        games_won as gamesWon,
        total_points as totalPoints,
        highest_score as highestScore,
        lowest_score as lowestScore,
        total_correct as correctAnswers,
        total_wrong as wrongAnswers,
        total_buzzer_attempts as totalBuzzerAttempts,
        total_buzzer_wins as totalBuzzerWins,
        daily_doubles_correct as dailyDoublesCorrect,
        final_jeopardy_correct as finalJeopardyCorrect,
        current_streak as currentStreak,
        best_streak as bestStreak
      FROM user_stats
      WHERE user_id = ?
    `);

    const row = stmt.get(userId) as StatsRow | undefined;
    if (!row) {
      return createEmptyUserStats(userId);
    }

    return withDerivedRates(row);
  }

  recordGameCompletion(gameResult: GameResult): void {
    runInTransaction((db) => {
      const gameId = randomUUID();

      const insertGame = db.prepare(`
        INSERT INTO games (id, room_code, started_at, ended_at, winner_id)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertGame.run(
        gameId,
        gameResult.roomCode,
        gameResult.startedAt,
        gameResult.endedAt,
        gameResult.winnerId
      );

      const insertGamePlayer = db.prepare(`
        INSERT INTO game_players (
          game_id,
          user_id,
          final_score,
          correct_answers,
          wrong_answers,
          buzzer_attempts,
          buzzer_wins,
          daily_double_correct,
          daily_double_wrong,
          final_jeopardy_correct,
          placement
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const ensureStatsRow = db.prepare(`
        INSERT OR IGNORE INTO user_stats (user_id)
        VALUES (?)
      `);

      const updateStats = db.prepare(`
        UPDATE user_stats
        SET
          games_played = games_played + 1,
          games_won = games_won + ?,
          total_points = total_points + ?,
          highest_score = MAX(highest_score, ?),
          lowest_score = CASE WHEN games_played = 0 THEN ? ELSE MIN(lowest_score, ?) END,
          total_correct = total_correct + ?,
          total_wrong = total_wrong + ?,
          total_buzzer_attempts = total_buzzer_attempts + ?,
          total_buzzer_wins = total_buzzer_wins + ?,
          daily_doubles_correct = daily_doubles_correct + ?,
          final_jeopardy_correct = final_jeopardy_correct + ?,
          current_streak = CASE WHEN ? = 1 THEN current_streak + 1 ELSE 0 END,
          best_streak = MAX(
            best_streak,
            CASE WHEN ? = 1 THEN current_streak + 1 ELSE current_streak END
          )
        WHERE user_id = ?
      `);

      for (const player of gameResult.players) {
        insertGamePlayer.run(
          gameId,
          player.userId,
          player.finalScore,
          player.correctAnswers,
          player.wrongAnswers,
          player.buzzerAttempts,
          player.buzzerWins,
          player.dailyDoubleCorrect,
          player.dailyDoubleWrong,
          player.finalJeopardyCorrect,
          player.placement
        );

        ensureStatsRow.run(player.userId);

        const isWinner = player.userId === gameResult.winnerId ? 1 : 0;
        updateStats.run(
          isWinner,
          player.finalScore,
          player.finalScore,
          player.finalScore,
          player.finalScore,
          player.correctAnswers,
          player.wrongAnswers,
          player.buzzerAttempts,
          player.buzzerWins,
          player.dailyDoubleCorrect,
          player.finalJeopardyCorrect,
          isWinner,
          isWinner,
          player.userId
        );
      }
    });
  }

  getLeaderboard(limit: number = 10): UserStats[] {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT
        user_id as userId,
        games_played as gamesPlayed,
        games_won as gamesWon,
        total_points as totalPoints,
        highest_score as highestScore,
        lowest_score as lowestScore,
        total_correct as correctAnswers,
        total_wrong as wrongAnswers,
        total_buzzer_attempts as totalBuzzerAttempts,
        total_buzzer_wins as totalBuzzerWins,
        daily_doubles_correct as dailyDoublesCorrect,
        final_jeopardy_correct as finalJeopardyCorrect,
        current_streak as currentStreak,
        best_streak as bestStreak
      FROM user_stats
      WHERE games_played > 0
      ORDER BY games_won DESC, highest_score DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as StatsRow[];
    return rows.map(withDerivedRates);
  }

  getUserRecentGames(userId: string, limit: number = 10): unknown[] {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT
        g.id,
        g.room_code as roomCode,
        g.started_at as startedAt,
        g.ended_at as endedAt,
        g.winner_id as winnerId,
        gp.final_score as finalScore,
        gp.placement
      FROM games g
      JOIN game_players gp ON g.id = gp.game_id
      WHERE gp.user_id = ?
      ORDER BY g.ended_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, limit) as unknown[];
  }
}
