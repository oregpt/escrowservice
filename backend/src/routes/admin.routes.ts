import { Router } from 'express';
import { pool } from '../db/connection.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, ServiceType } from '../types/index.js';

const router = Router();

// TODO: Add admin role check middleware
// For now, any authenticated user can access admin routes

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

// Update service type configuration
router.put('/service-types/:id', requireAuth, async (req, res) => {
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

// Create new service type
router.post('/service-types', requireAuth, async (req, res) => {
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

// Get platform stats (for admin dashboard)
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [escrowStats, userStats, volumeStats] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'FUNDED') as active_escrows,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_escrows,
          COUNT(*) FILTER (WHERE status = 'PENDING_ACCEPTANCE') as pending_escrows,
          COUNT(*) as total_escrows
        FROM escrows
      `),
      pool.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE is_provider = true) as providers
        FROM users
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(platform_fee), 0) as total_fees
        FROM escrows
        WHERE status = 'COMPLETED'
      `),
    ]);

    const stats = {
      escrows: {
        active: parseInt(escrowStats.rows[0].active_escrows),
        completed: parseInt(escrowStats.rows[0].completed_escrows),
        pending: parseInt(escrowStats.rows[0].pending_escrows),
        total: parseInt(escrowStats.rows[0].total_escrows),
      },
      users: {
        total: parseInt(userStats.rows[0].total_users),
        providers: parseInt(userStats.rows[0].providers),
      },
      volume: {
        total: parseFloat(volumeStats.rows[0].total_volume),
        fees: parseFloat(volumeStats.rows[0].total_fees),
      },
    };

    const response: ApiResponse<typeof stats> = {
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

export default router;
