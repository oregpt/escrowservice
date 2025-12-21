import { Router } from 'express';
import { userService } from '../services/user.service.js';
import type { ApiResponse, User } from '../types/index.js';

const router = Router();

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

// Login with username/password (development mode)
router.post('/login', async (req, res) => {
  try {
    const { username, password, email, displayName, externalId, avatarUrl } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    // Support both username/password and email-based login
    const identifier = username || email;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Username or email is required',
      });
    }

    // Simple admin login for development
    if (username === 'admin' && password === 'admin123') {
      // Check if admin user exists, create if not
      let user = await userService.getUserByEmail('admin@escrowservice.local');
      if (!user) {
        user = await userService.createAuthenticatedUser(
          'admin@escrowservice.local',
          'Administrator',
          'admin',
          undefined
        );
        // Set admin role
        const { pool } = await import('../db/connection.js');
        await pool.query(
          `UPDATE users SET role = 'admin' WHERE id = $1`,
          [user.id]
        );
        user.role = 'admin';
      }
      if (sessionId) {
        await userService.linkSession(user.id, sessionId);
      }
      const response: ApiResponse<{ user: User; sessionId: string }> = {
        success: true,
        data: { user, sessionId: sessionId || crypto.randomUUID() },
      };
      return res.json(response);
    }

    // For other users, treat username as email if no @ symbol
    const userEmail = identifier.includes('@') ? identifier : `${identifier}@escrowservice.local`;

    // Check if user exists with this email
    let user = await userService.getUserByEmail(userEmail);

    if (user) {
      // Link session to existing user
      if (sessionId) {
        await userService.linkSession(user.id, sessionId);
      }
    } else if (sessionId) {
      // Try to upgrade anonymous session user
      const sessionUser = await userService.getUserBySessionId(sessionId);
      if (sessionUser && !sessionUser.isAuthenticated) {
        user = await userService.upgradeToAuthenticated(
          sessionUser.id,
          userEmail,
          displayName || username,
          externalId,
          avatarUrl
        );
      } else {
        // Create new authenticated user
        user = await userService.createAuthenticatedUser(userEmail, displayName || username, externalId, avatarUrl);
        await userService.linkSession(user.id, sessionId);
      }
    } else {
      // Create new authenticated user
      user = await userService.createAuthenticatedUser(userEmail, displayName || username, externalId, avatarUrl);
    }

    const newSessionId = sessionId || crypto.randomUUID();
    if (!sessionId && user) {
      await userService.linkSession(user.id, newSessionId);
    }

    const response: ApiResponse<{ user: User; sessionId: string }> = {
      success: true,
      data: { user: user!, sessionId: newSessionId },
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

export default router;
