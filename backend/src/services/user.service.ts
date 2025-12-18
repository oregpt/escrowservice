import { pool } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import type { User, UserWithPassword, UserRole } from '../types/index.js';

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

  // Get user by username
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  // Get user with password (for auth only)
  async getUserWithPassword(username: string): Promise<UserWithPassword | null> {
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUserWithPassword(result.rows[0]);
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
      `INSERT INTO users (session_id, is_authenticated, role)
       VALUES ($1, false, 'user')
       RETURNING *`,
      [sessionId]
    );

    return this.mapRowToUser(result.rows[0]);
  }

  // Create authenticated user with email (legacy/OAuth)
  async createAuthenticatedUser(
    email: string,
    displayName?: string,
    externalId?: string,
    avatarUrl?: string
  ): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (email, display_name, external_id, avatar_url, is_authenticated, role)
       VALUES ($1, $2, $3, $4, true, 'user')
       RETURNING *`,
      [email, displayName, externalId, avatarUrl]
    );

    return this.mapRowToUser(result.rows[0]);
  }

  // Create authenticated user with password
  async createAuthenticatedUserWithPassword(
    username: string,
    passwordHash: string,
    email?: string,
    displayName?: string
  ): Promise<User> {
    const sessionId = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email, display_name, session_id, is_authenticated, role)
       VALUES ($1, $2, $3, $4, $5, true, 'user')
       RETURNING *`,
      [username, passwordHash, email, displayName, sessionId]
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

  // Upgrade anonymous user to authenticated (email only)
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

  // Convert anonymous to authenticated with password
  async convertToAuthenticated(
    userId: string,
    username: string,
    passwordHash: string,
    email?: string,
    displayName?: string
  ): Promise<User> {
    const result = await pool.query(
      `UPDATE users
       SET username = $1, password_hash = $2, email = $3, display_name = $4,
           is_authenticated = true, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [username, passwordHash, email, displayName, userId]
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
      email?: string;
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

    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      params.push(updates.email);
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

  // Update user role (admin only)
  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const result = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [role, userId]
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

  // Get all users (admin only)
  async getAllUsers(limit = 100, offset = 0): Promise<User[]> {
    const result = await pool.query(
      `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows.map((row: any) => this.mapRowToUser(row));
  }

  // Get users by role (admin only)
  async getUsersByRole(role: UserRole): Promise<User[]> {
    const result = await pool.query(
      `SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC`,
      [role]
    );

    return result.rows.map((row: any) => this.mapRowToUser(row));
  }

  // Check if user is platform admin
  async isPlatformAdmin(userId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );

    return result.rows.length > 0 && result.rows[0].role === 'platform_admin';
  }

  // Helper: Map DB row to User
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      externalId: row.external_id,
      email: row.email,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      role: row.role || 'user',
      isAuthenticated: row.is_authenticated,
      isProvider: row.is_provider,
      sessionId: row.session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper: Map DB row to UserWithPassword (internal use only)
  private mapRowToUserWithPassword(row: any): UserWithPassword {
    return {
      ...this.mapRowToUser(row),
      passwordHash: row.password_hash,
    };
  }
}

export const userService = new UserService();
