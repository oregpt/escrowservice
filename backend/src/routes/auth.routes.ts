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

// Login (upgrade anonymous to authenticated)
router.post('/login', async (req, res) => {
  try {
    const { email, displayName, externalId, avatarUrl } = req.body;
    const sessionId = req.headers['x-session-id'] as string;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Check if user exists with this email
    let user = await userService.getUserByEmail(email);

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
          email,
          displayName,
          externalId,
          avatarUrl
        );
      } else {
        // Create new authenticated user
        user = await userService.createAuthenticatedUser(email, displayName, externalId, avatarUrl);
        await userService.linkSession(user.id, sessionId);
      }
    } else {
      // Create new authenticated user
      user = await userService.createAuthenticatedUser(email, displayName, externalId, avatarUrl);
    }

    const response: ApiResponse<{ user: User }> = {
      success: true,
      data: { user: user! },
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
