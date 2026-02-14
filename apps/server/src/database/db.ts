// SQLite Database Connection
// Handles database initialization and provides a singleton connection

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file path
const DB_PATH = join(__dirname, '../../data/jeopardy.db');

// Singleton database instance
let db: Database.Database | null = null;

/**
 * Initialize the database connection and create tables if they don't exist
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Create database connection
  db = new Database(DB_PATH, {
    verbose: (message) => console.log('[DB]', message),
  });

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Read and execute schema
  const schemaPath = existsSync(join(__dirname, 'schema.sql'))
    ? join(__dirname, 'schema.sql')
    : join(__dirname, '../../src/database/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Execute schema (creates tables if not exist)
  db.exec(schema);

  console.log(`[DB] Database initialized at ${DB_PATH}`);

  return db;
}

/**
 * Get the current database instance
 * Throws error if database hasn't been initialized
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }

  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed');
  }
}

/**
 * Run a database query in a transaction
 * Automatically rolls back on error
 */
export function runInTransaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDatabase();

  const transaction = database.transaction(fn);
  return transaction(database);
}
