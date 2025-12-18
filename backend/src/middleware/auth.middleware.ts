import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import { organizationService } from '../services/organization.service.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
      sessionId?: string;
    }
  }
}

// Require authentication - blocks if not authenticated
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.headers['x-session-id'] as string;

    if (!sessionId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Provide X-Session-ID header.',
      });
      return;
    }

    const user = await userService.getUserBySessionId(sessionId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid session. Please create a new session.',
      });
      return;
    }

    req.userId = user.id;
    req.user = user;
    req.sessionId = sessionId;

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
}

// Optional authentication - proceeds even if not authenticated
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.headers['x-session-id'] as string;

    if (sessionId) {
      const user = await userService.getUserBySessionId(sessionId);
      if (user) {
        req.userId = user.id;
        req.user = user;
        req.sessionId = sessionId;
      }
    }

    next();
  } catch (error) {
    // Continue without auth on error
    next();
  }
}

// Require specific organization permission
export function requireOrgPermission(
  permission: 'canUseOrgAccount' | 'canCreateEscrows' | 'canManageMembers'
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      const orgId = req.params.orgId || req.body.organizationId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (!orgId) {
        res.status(400).json({
          success: false,
          error: 'Organization ID required',
        });
        return;
      }

      const hasPermission = await organizationService.hasPermission(orgId, userId, permission);

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: `Permission denied: ${permission}`,
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Authorization error',
      });
    }
  };
}

// Rate limiting middleware (simple in-memory implementation)
const rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.sessionId || 'unknown';
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
      return;
    }

    record.count++;
    next();
  };
}
