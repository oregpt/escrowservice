import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/connection.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { userService } from '../services/user.service.js';
import type { ApiResponse, ServiceType, PlatformStats, User } from '../types/index.js';

const router = Router();

// Platform Admin middleware - requires platform_admin role
const requirePlatformAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const isAdmin = await userService.isPlatformAdmin(user.id);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Platform admin access required' });
  }

  next();
};

// ===============================================
// PUBLIC ADMIN ROUTES (any authenticated user)
// ===============================================

// Get all service types with full config
router.get('/service-types', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM service_types ORDER BY name`
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

    const response: ApiResponse<typeof serviceTypes> = {
      success: true,
      data: serviceTypes,
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

// Get single service type
router.get('/service-types/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM service_types WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service type not found',
      });
    }

    const row = result.rows[0];
    const serviceType = {
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
    };

    const response: ApiResponse<typeof serviceType> = {
      success: true,
      data: serviceType,
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

// ===============================================
// PLATFORM ADMIN ONLY ROUTES
// ===============================================

// Get comprehensive platform stats
router.get('/stats', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const [escrowStats, userStats, volumeStats, orgStats, accountStats] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('FUNDED', 'PARTY_B_CONFIRMED', 'PARTY_A_CONFIRMED')) as active_escrows,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_escrows,
          COUNT(*) FILTER (WHERE status IN ('CREATED', 'PENDING_ACCEPTANCE', 'PENDING_FUNDING')) as pending_escrows,
          COUNT(*) FILTER (WHERE status = 'CANCELED') as canceled_escrows,
          COUNT(*) as total_escrows
        FROM escrows
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE is_authenticated = true) as authenticated_users,
          COUNT(*) FILTER (WHERE is_authenticated = false) as anonymous_users,
          COUNT(*) FILTER (WHERE is_provider = true) as providers,
          COUNT(*) FILTER (WHERE role = 'platform_admin') as admins
        FROM users
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(platform_fee), 0) as total_fees
        FROM escrows
        WHERE status = 'COMPLETED'
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_orgs,
          COUNT(*) FILTER (WHERE is_active = true) as active_orgs
        FROM organizations
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(available_balance + in_contract_balance), 0) as total_balance,
          COALESCE(SUM(in_contract_balance), 0) as in_contract,
          COALESCE(SUM(available_balance), 0) as available
        FROM accounts
      `),
    ]);

    const stats: PlatformStats = {
      users: {
        total: parseInt(userStats.rows[0].total_users),
        authenticated: parseInt(userStats.rows[0].authenticated_users),
        anonymous: parseInt(userStats.rows[0].anonymous_users),
        providers: parseInt(userStats.rows[0].providers),
        admins: parseInt(userStats.rows[0].admins),
      },
      organizations: {
        total: parseInt(orgStats.rows[0].total_orgs),
        active: parseInt(orgStats.rows[0].active_orgs),
      },
      escrows: {
        total: parseInt(escrowStats.rows[0].total_escrows),
        active: parseInt(escrowStats.rows[0].active_escrows),
        completed: parseInt(escrowStats.rows[0].completed_escrows),
        canceled: parseInt(escrowStats.rows[0].canceled_escrows),
        totalVolume: parseFloat(volumeStats.rows[0].total_volume),
        totalFees: parseFloat(volumeStats.rows[0].total_fees),
      },
      accounts: {
        totalBalance: parseFloat(accountStats.rows[0].total_balance),
        inContract: parseFloat(accountStats.rows[0].in_contract),
        available: parseFloat(accountStats.rows[0].available),
      },
    };

    const response: ApiResponse<PlatformStats> = {
      success: true,
      data: stats,
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

// Get all users (platform admin only)
router.get('/users', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const role = req.query.role as string;

    let query = `SELECT * FROM users`;
    const params: any[] = [];

    if (role) {
      query += ` WHERE role = $1`;
      params.push(role);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const users = result.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      role: row.role || 'user',
      isAuthenticated: row.is_authenticated,
      isProvider: row.is_provider,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const response: ApiResponse<typeof users> = {
      success: true,
      data: users,
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

// Update user role (platform admin only)
router.patch('/users/:id/role', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'provider', 'admin', 'platform_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be: user, provider, admin, or platform_admin',
      });
    }

    const user = await userService.updateUserRole(id, role);

    const response: ApiResponse<User> = {
      success: true,
      data: user,
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

// Get all organizations (platform admin only)
router.get('/organizations', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT o.*,
        (SELECT COUNT(*) FROM org_members WHERE organization_id = o.id) as member_count,
        (SELECT COALESCE(SUM(available_balance + in_contract_balance), 0) FROM accounts WHERE organization_id = o.id) as total_balance
       FROM organizations o
       ORDER BY o.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const organizations = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url,
      billingEmail: row.billing_email,
      isActive: row.is_active,
      memberCount: parseInt(row.member_count),
      totalBalance: parseFloat(row.total_balance),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const response: ApiResponse<typeof organizations> = {
      success: true,
      data: organizations,
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

// Get all escrows (platform admin only)
router.get('/escrows', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    let query = `
      SELECT e.*,
        u1.display_name as party_a_name, u1.email as party_a_email,
        u2.display_name as party_b_name, u2.email as party_b_email,
        st.name as service_type_name
      FROM escrows e
      LEFT JOIN users u1 ON e.party_a_user_id = u1.id
      LEFT JOIN users u2 ON e.party_b_user_id = u2.id
      LEFT JOIN service_types st ON e.service_type_id = st.id
    `;
    const params: any[] = [];

    if (status) {
      query += ` WHERE e.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const escrows = result.rows.map((row: any) => ({
      id: row.id,
      serviceTypeId: row.service_type_id,
      serviceTypeName: row.service_type_name,
      partyAUserId: row.party_a_user_id,
      partyAName: row.party_a_name,
      partyAEmail: row.party_a_email,
      partyBUserId: row.party_b_user_id,
      partyBName: row.party_b_name,
      partyBEmail: row.party_b_email,
      status: row.status,
      amount: parseFloat(row.amount),
      currency: row.currency,
      platformFee: parseFloat(row.platform_fee),
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const response: ApiResponse<typeof escrows> = {
      success: true,
      data: escrows,
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

// Update service type configuration (platform admin only)
router.put('/service-types/:id', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      platformFeePercent,
      metadataSchema,
      partyADelivers,
      partyBDelivers,
      autoAcceptable,
      requiresPartyAConfirmation,
      requiresPartyBConfirmation,
      isActive,
    } = req.body;

    const result = await pool.query(
      `UPDATE service_types SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        platform_fee_percent = COALESCE($3, platform_fee_percent),
        metadata_schema = COALESCE($4, metadata_schema),
        party_a_delivers = COALESCE($5, party_a_delivers),
        party_b_delivers = COALESCE($6, party_b_delivers),
        auto_acceptable = COALESCE($7, auto_acceptable),
        requires_party_a_confirmation = COALESCE($8, requires_party_a_confirmation),
        requires_party_b_confirmation = COALESCE($9, requires_party_b_confirmation),
        is_active = COALESCE($10, is_active)
       WHERE id = $11
       RETURNING *`,
      [
        name,
        description,
        platformFeePercent,
        metadataSchema ? JSON.stringify(metadataSchema) : null,
        partyADelivers ? JSON.stringify(partyADelivers) : null,
        partyBDelivers ? JSON.stringify(partyBDelivers) : null,
        autoAcceptable,
        requiresPartyAConfirmation,
        requiresPartyBConfirmation,
        isActive,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service type not found',
      });
    }

    const row = result.rows[0];
    const serviceType = {
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
    };

    const response: ApiResponse<typeof serviceType> = {
      success: true,
      data: serviceType,
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

// Create new service type (platform admin only)
router.post('/service-types', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const {
      id,
      name,
      description,
      platformFeePercent = 15,
      metadataSchema = {},
      partyADelivers = { type: 'FIAT_USD', label: 'Payment' },
      partyBDelivers = { type: 'ANY', label: 'Service' },
      autoAcceptable = true,
      requiresPartyAConfirmation = true,
      requiresPartyBConfirmation = true,
    } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        error: 'id and name are required',
      });
    }

    const result = await pool.query(
      `INSERT INTO service_types (
        id, name, description, platform_fee_percent, metadata_schema,
        party_a_delivers, party_b_delivers, auto_acceptable,
        requires_party_a_confirmation, requires_party_b_confirmation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        name,
        description,
        platformFeePercent,
        JSON.stringify(metadataSchema),
        JSON.stringify(partyADelivers),
        JSON.stringify(partyBDelivers),
        autoAcceptable,
        requiresPartyAConfirmation,
        requiresPartyBConfirmation,
      ]
    );

    const row = result.rows[0];
    const serviceType = {
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
    };

    const response: ApiResponse<typeof serviceType> = {
      success: true,
      data: serviceType,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export default router;
