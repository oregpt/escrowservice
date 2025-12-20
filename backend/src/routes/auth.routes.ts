import { Router } from 'express';
import bcrypt from 'bcrypt';
import { userService } from '../services/user.service.js';
import type { ApiResponse, User, RegisterRequest, LoginRequest, ConvertAccountRequest } from '../types/index.js';

const router = Router();

const SALT_ROUNDS = 10;

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
    const { username, password, email, displayName } = req.body as RegisterRequest;
    const sessionId = req.headers['x-session-id'] as string;

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

    // Create authenticated user
    const user = await userService.createAuthenticatedUserWithPassword(
      username,
      passwordHash,
      email,
      displayName
    );

    // Link to session if exists
    if (sessionId) {
      await userService.linkSession(user.id, sessionId);
    }

    const response: ApiResponse<{ user: User; sessionId: string }> = {
      success: true,
      data: { user, sessionId: user.sessionId || sessionId },
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

export default router;
