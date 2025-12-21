import { pool } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import type { User } from '../types/index.js';

export class UserService {
  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    const result = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  // Get user by session ID
  async getUserBySessionId(sessionId: string): Promise<User | null> {
    const result = await pool.query(
      `SELECT * FROM users WHERE session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  // Get user by external ID (OAuth provider ID)
  async getUserByExternalId(externalId: string): Promise<User | null> {
    const result = await pool.query(
      `SELECT * FROM users WHERE external_id = $1`,
      [externalId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  // Create anonymous user with session
  async createAnonymousUser(sessionId: string): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (session_id, is_authenticated)
       VALUES ($1, false)
       RETURNING *`,
      [sessionId]
    );

    return this.mapRowToUser(result.rows[0]);
  }

  // Create authenticated user
  async createAuthenticatedUser(
    email: string,
    displayName?: string,
    externalId?: string,
    avatarUrl?: string
  ): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (email, display_name, external_id, avatar_url, is_authenticated)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [email, displayName, externalId, avatarUrl]
    );

    return this.mapRowToUser(result.rows[0]);
  }

  // Get or create user from session
  async getOrCreateFromSession(sessionId: string): Promise<User> {
    let user = await this.getUserBySessionId(sessionId);
    if (!user) {
      user = await this.createAnonymousUser(sessionId);
    }
    return user;
  }

  // Upgrade anonymous user to authenticated
  async upgradeToAuthenticated(
    userId: string,
    email: string,
    displayName?: string,
    externalId?: string,
    avatarUrl?: string
  ): Promise<User> {
    const result = await pool.query(
      `UPDATE users
       SET email = $1, display_name = $2, external_id = $3, avatar_url = $4,
           is_authenticated = true, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [email, displayName, externalId, avatarUrl, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapRowToUser(result.rows[0]);
  }

  // Update user profile
  async updateUser(
    userId: string,
    updates: {
      displayName?: string;
      avatarUrl?: string;
      isProvider?: boolean;
    }
  ): Promise<User> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      params.push(updates.displayName);
    }

    if (updates.avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex++}`);
      params.push(updates.avatarUrl);
    }

    if (updates.isProvider !== undefined) {
      setClauses.push(`is_provider = $${paramIndex++}`);
      params.push(updates.isProvider);
    }

    if (setClauses.length === 0) {
      const user = await this.getUserById(userId);
      if (!user) throw new Error('User not found');
      return user;
    }

    setClauses.push('updated_at = NOW()');
    params.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return this.mapRowToUser(result.rows[0]);
  }

  // Link session to user (after auth)
  async linkSession(userId: string, sessionId: string): Promise<void> {
    await pool.query(
      `UPDATE users SET session_id = $1, updated_at = NOW() WHERE id = $2`,
      [sessionId, userId]
    );
  }

  // Clear session (logout)
  async clearSession(userId: string): Promise<void> {
    await pool.query(
      `UPDATE users SET session_id = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  // Helper: Map DB row to User
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      externalId: row.external_id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      isAuthenticated: row.is_authenticated,
      isProvider: row.is_provider,
      sessionId: row.session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const userService = new UserService();
