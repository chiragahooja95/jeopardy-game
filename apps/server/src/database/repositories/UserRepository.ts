// User Repository
// Handles CRUD operations for user profiles

import type { User } from '@jeopardy/shared';
import { getDatabase } from '../db.js';

export class UserRepository {
  /**
   * Create a new user
   *
   * @param id - User ID (UUID)
   * @param name - User name
   * @returns Created user
   */
  createUser(id: string, name: string): User {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO users (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, name, now, now);

    // Also create initial stats entry
    const statsStmt = db.prepare(`
      INSERT INTO user_stats (user_id)
      VALUES (?)
    `);

    statsStmt.run(id);

    return {
      id,
      name,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a user by ID
   *
   * @param id - User ID
   * @returns User or null if not found
   */
  getUser(id: string): User | null {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT id, name, created_at as createdAt, updated_at as updatedAt
      FROM users
      WHERE id = ?
    `);

    const row = stmt.get(id) as User | undefined;

    return row || null;
  }

  /**
   * Update user name
   *
   * @param id - User ID
   * @param name - New name
   * @returns Updated user or null if not found
   */
  updateUserName(id: string, name: string): User | null {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(name, now, id);

    if (result.changes === 0) {
      return null;
    }

    return this.getUser(id);
  }

  /**
   * Check if a user exists
   *
   * @param id - User ID
   * @returns True if user exists
   */
  userExists(id: string): boolean {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT 1 FROM users WHERE id = ? LIMIT 1
    `);

    return !!stmt.get(id);
  }

  /**
   * Create or update user (upsert)
   *
   * @param id - User ID
   * @param name - User name
   * @returns User
   */
  upsertUser(id: string, name: string): User {
    if (this.userExists(id)) {
      const updated = this.updateUserName(id, name);
      return updated!;
    } else {
      return this.createUser(id, name);
    }
  }

  /**
   * Get all users (for admin purposes)
   *
   * @param limit - Maximum number of users to return
   * @returns Array of users
   */
  getAllUsers(limit: number = 100): User[] {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT id, name, created_at as createdAt, updated_at as updatedAt
      FROM users
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(limit) as User[];
  }
}
