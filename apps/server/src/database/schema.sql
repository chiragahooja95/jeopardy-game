-- Jeopardy Game Database Schema
-- SQLite database for user profiles, game history, and statistics

-- ============================================================================
-- User Profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================================
-- Game History
-- ============================================================================

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  winner_id TEXT,
  FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_games_started_at ON games(started_at);
CREATE INDEX IF NOT EXISTS idx_games_winner_id ON games(winner_id);

-- ============================================================================
-- Player Participation in Games
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_players (
  game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  final_score INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  buzzer_attempts INTEGER NOT NULL DEFAULT 0,
  buzzer_wins INTEGER NOT NULL DEFAULT 0,
  daily_double_correct INTEGER NOT NULL DEFAULT 0,
  daily_double_wrong INTEGER NOT NULL DEFAULT 0,
  final_jeopardy_correct INTEGER NOT NULL DEFAULT 0,
  placement INTEGER NOT NULL,
  PRIMARY KEY (game_id, user_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);

-- ============================================================================
-- Aggregated Statistics (Denormalized for Performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  highest_score INTEGER NOT NULL DEFAULT 0,
  lowest_score INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_wrong INTEGER NOT NULL DEFAULT 0,
  total_buzzer_attempts INTEGER NOT NULL DEFAULT 0,
  total_buzzer_wins INTEGER NOT NULL DEFAULT 0,
  daily_doubles_correct INTEGER NOT NULL DEFAULT 0,
  final_jeopardy_correct INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_stats_games_won ON user_stats(games_won);
CREATE INDEX IF NOT EXISTS idx_user_stats_highest_score ON user_stats(highest_score);
