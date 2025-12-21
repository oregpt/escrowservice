import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../db/connection.js';
import { userService } from '../services/user.service.js';
import { emailService } from '../services/email.service.js';
import type { ApiResponse, User, RegisterRequest, LoginRequest, ConvertAccountRequest } from '../types/index.js';

const router = Router();

const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// Get current session/user
router.get('/me', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      const response: ApiResponse<{ user: null; authenticated: false }> = {
        success: true,
        data: { user: null, authenticated: false },
      };
      return res.json(response);
    }

    const user = await userService.getOrCreateFromSession(sessionId);
    const response: ApiResponse<{ user: User; authenticated: boolean }> = {
      success: true,
      data: { user, authenticated: user.isAuthenticated },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Start session (for anonymous users)
router.post('/session', async (req, res) => {
  try {
    const sessionId = req.body.sessionId || crypto.randomUUID();
    const user = await userService.getOrCreateFromSession(sessionId);

    const response: ApiResponse<{ user: User; sessionId: string }> = {
      success: true,
      data: { user, sessionId },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Register new account with username/password
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, displayName, organizationName } = req.body as RegisterRequest & { organizationName?: string };
    let sessionId = req.headers['x-session-id'] as string;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    // Check if username already exists
    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken',
      });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await userService.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email already registered',
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create authenticated user with optional organization name
    const user = await userService.createAuthenticatedUserWithPassword(
      username,
      passwordHash,
      email,
      displayName,
      organizationName
    );

    // Generate new session ID if not provided
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    // Link session to user (always - this logs them in automatically)
    await userService.linkSession(user.id, sessionId);

    const response: ApiResponse<{ user: User; sessionId: string }> = {
      success: true,
      data: { user, sessionId },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Login with username/password
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as LoginRequest;
    const sessionId = req.headers['x-session-id'] as string;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    // Get user with password
    const userWithPassword = await userService.getUserWithPassword(username);
    if (!userWithPassword || !userWithPassword.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password',
      });
    }

    // Verify password
    const valid = await bcrypt.compare(password, userWithPassword.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password',
      });
    }

    // Generate new session if not provided
    const newSessionId = sessionId || crypto.randomUUID();
    await userService.linkSession(userWithPassword.id, newSessionId);

    // Remove password from response
    const { passwordHash, ...user } = userWithPassword;

    const response: ApiResponse<{ user: User; sessionId: string }> = {
      success: true,
      data: { user: user as User, sessionId: newSessionId },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Convert anonymous account to authenticated (save your progress)
router.post('/convert', async (req, res) => {
  try {
    const { username, password, email, displayName } = req.body as ConvertAccountRequest;
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'No session to convert. Start a session first.',
      });
    }

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    // Get current session user
    const sessionUser = await userService.getUserBySessionId(sessionId);
    if (!sessionUser) {
      return res.status(400).json({
        success: false,
        error: 'Session not found',
      });
    }

    if (sessionUser.isAuthenticated) {
      return res.status(400).json({
        success: false,
        error: 'Account is already authenticated',
      });
    }

    // Check if username already exists
    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken',
      });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await userService.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email already registered',
        });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Convert anonymous to authenticated
    const user = await userService.convertToAuthenticated(
      sessionUser.id,
      username,
      passwordHash,
      email,
      displayName
    );

    const response: ApiResponse<{ user: User; message: string }> = {
      success: true,
      data: {
        user,
        message: 'Account converted successfully! Your progress has been saved.',
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;

    if (sessionId) {
      const user = await userService.getUserBySessionId(sessionId);
      if (user) {
        await userService.clearSession(user.id);
      }
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Logged out successfully' },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// Password Reset
// ============================================================================

// Request password reset (forgot password)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Always return success to prevent email enumeration
    const successResponse: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'If an account exists with this email, you will receive a password reset link.',
      },
    };

    // Find user by email
    const user = await userService.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return res.json(successResponse);
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any existing tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );

    // Store new token
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, resetToken, expiresAt]
    );

    // Send email
    const emailSent = await emailService.sendPasswordResetEmail(
      email,
      resetToken,
      user.displayName
    );

    if (!emailSent && !emailService.isConfigured()) {
      // In development, return the token if email not configured
      console.log('[Auth] Reset token (email not configured):', resetToken);
    }

    res.json(successResponse);
  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to process request',
    };
    res.status(500).json(response);
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    // Find valid token
    const tokenResult = await pool.query(
      `SELECT t.*, u.email, u.display_name
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = $1
         AND t.used_at IS NULL
         AND t.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link. Please request a new one.',
      });
    }

    const resetRecord = tokenResult.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Update user's password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, resetRecord.user_id]
    );

    // Mark token as used
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [resetRecord.id]
    );

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Password reset successfully. You can now sign in with your new password.',
      },
    };
    res.json(response);
  } catch (error) {
    console.error('[Auth] Reset password error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to reset password',
    };
    res.status(500).json(response);
  }
});

// Validate reset token (for UI to check if token is valid)
router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const tokenResult = await pool.query(
      `SELECT t.expires_at, u.email
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = $1
         AND t.used_at IS NULL
         AND t.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link',
      });
    }

    const response: ApiResponse<{ valid: boolean; email: string }> = {
      success: true,
      data: {
        valid: true,
        email: tokenResult.rows[0].email,
      },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to validate token',
    };
    res.status(500).json(response);
  }
});

export default router;
