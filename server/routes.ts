import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { Pool } from "pg";

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // CORS configuration
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Import and mount backend routes dynamically
  try {
    const { apiRoutes, webhookRoutes } = await import('../backend/src/routes/index.js');
    
    // Webhooks need raw body - mount before JSON parsing in main server
    app.use('/webhooks', webhookRoutes);
    
    // API routes
    app.use('/api', apiRoutes);
    
    console.log('[Routes] Backend API routes mounted successfully');
  } catch (error) {
    console.error('[Routes] Failed to load backend routes:', error);
    
    // Fallback: Mount basic routes if backend fails to load
    await mountBasicRoutes(app);
  }

  return httpServer;
}

// Basic routes fallback if backend module loading fails
async function mountBasicRoutes(app: Express) {
  console.log('[Routes] Using basic fallback routes');

  // Service types endpoint
  app.get('/api/service-types', async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM service_types WHERE is_active = true ORDER BY name`
      );

      const serviceTypes = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        partyADelivers: row.party_a_delivers,
        partyBDelivers: row.party_b_delivers,
        platformFeePercent: parseFloat(row.platform_fee_percent),
        autoAcceptable: row.auto_acceptable,
        requiresPartyAConfirmation: row.requires_party_a_confirmation,
        requiresPartyBConfirmation: row.requires_party_b_confirmation,
        metadataSchema: row.metadata_schema,
        isActive: row.is_active,
        createdAt: row.created_at,
      }));

      res.json({
        success: true,
        data: serviceTypes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Auth session endpoint
  app.get('/api/auth/me', async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;

      if (!sessionId) {
        return res.json({
          success: true,
          data: { user: null, authenticated: false },
        });
      }

      // Check if user exists with this session
      const result = await pool.query(
        `SELECT * FROM users WHERE session_id = $1`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: { user: null, authenticated: false },
        });
      }

      const row = result.rows[0];
      const user = {
        id: row.id,
        email: row.email,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        role: row.role,
        isAuthenticated: row.is_authenticated,
        isProvider: row.is_provider,
        sessionId: row.session_id,
        primaryOrgId: row.primary_org_id,
        createdAt: row.created_at,
      };

      res.json({
        success: true,
        data: { user, authenticated: user.isAuthenticated },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Create session endpoint
  app.post('/api/auth/session', async (req, res) => {
    try {
      const sessionId = req.body.sessionId || crypto.randomUUID();
      
      // Check if session already exists
      let result = await pool.query(
        `SELECT * FROM users WHERE session_id = $1`,
        [sessionId]
      );

      let user;
      if (result.rows.length === 0) {
        // Create new anonymous user with org
        const userResult = await pool.query(
          `INSERT INTO users (session_id, is_authenticated, role)
           VALUES ($1, false, 'user')
           RETURNING *`,
          [sessionId]
        );
        const userId = userResult.rows[0].id;

        // Create a personal organization
        const orgName = `User ${userId.slice(0, 8)}`;
        const orgSlug = `user-${userId.slice(0, 8).toLowerCase()}`;
        const orgResult = await pool.query(
          `INSERT INTO organizations (name, slug)
           VALUES ($1, $2)
           RETURNING *`,
          [orgName, orgSlug]
        );
        const orgId = orgResult.rows[0].id;

        // Add user as admin of their org
        await pool.query(
          `INSERT INTO org_members (organization_id, user_id, role, can_use_org_account, can_create_escrows, can_manage_members)
           VALUES ($1, $2, 'admin', true, true, true)`,
          [orgId, userId]
        );

        // Set primary org and create account
        await pool.query(
          `UPDATE users SET primary_org_id = $1 WHERE id = $2`,
          [orgId, userId]
        );

        await pool.query(
          `INSERT INTO accounts (organization_id, available_balance, in_contract_balance, currency)
           VALUES ($1, 0, 0, 'USD')`,
          [orgId]
        );

        // Re-fetch user
        result = await pool.query(
          `SELECT * FROM users WHERE id = $1`,
          [userId]
        );
      }

      const row = result.rows[0];
      user = {
        id: row.id,
        email: row.email,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        role: row.role,
        isAuthenticated: row.is_authenticated,
        isProvider: row.is_provider,
        sessionId: row.session_id,
        primaryOrgId: row.primary_org_id,
        createdAt: row.created_at,
      };

      res.json({
        success: true,
        data: { user, sessionId },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Escrows list endpoint  
  app.get('/api/escrows', async (req, res) => {
    try {
      const sessionId = req.headers['x-session-id'] as string;
      
      if (!sessionId) {
        return res.json({ success: true, data: [] });
      }

      const userResult = await pool.query(
        `SELECT * FROM users WHERE session_id = $1`,
        [sessionId]
      );

      if (userResult.rows.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const userId = userResult.rows[0].id;
      const orgId = userResult.rows[0].primary_org_id;

      const result = await pool.query(
        `SELECT e.*, st.name as service_type_name
         FROM escrows e
         LEFT JOIN service_types st ON e.service_type_id = st.id
         WHERE e.party_a_user_id = $1 
            OR e.party_b_user_id = $1
            OR e.party_a_org_id = $2
            OR e.party_b_org_id = $2
         ORDER BY e.created_at DESC`,
        [userId, orgId]
      );

      const escrows = result.rows.map((row: any) => ({
        id: row.id,
        serviceTypeId: row.service_type_id,
        serviceTypeName: row.service_type_name,
        partyAUserId: row.party_a_user_id,
        partyBUserId: row.party_b_user_id,
        partyAOrgId: row.party_a_org_id,
        partyBOrgId: row.party_b_org_id,
        isOpen: row.is_open,
        counterpartyName: row.counterparty_name,
        counterpartyEmail: row.counterparty_email,
        privacyLevel: row.privacy_level,
        status: row.status,
        amount: parseFloat(row.amount),
        currency: row.currency,
        platformFee: row.platform_fee ? parseFloat(row.platform_fee) : null,
        title: row.title,
        description: row.description,
        terms: row.terms,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({ success: true, data: escrows });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
