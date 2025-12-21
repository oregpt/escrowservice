import { Router } from 'express';
import { providerSettingsService } from '../services/provider-settings.service.js';
import { userService } from '../services/user.service.js';
import { orgServiceTypeService } from '../services/org-service-type.service.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, ProviderSettings, ServiceType, OrgServiceTypeSetting } from '../types/index.js';
import { pool } from '../db/connection.js';

const router = Router();

// Get current user's provider settings (auto-accept rules)
router.get('/auto-accept', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const settings = await providerSettingsService.getSettingsForUser(userId);

    const response: ApiResponse<ProviderSettings[]> = {
      success: true,
      data: settings,
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

// Get specific auto-accept rule
router.get('/auto-accept/:serviceTypeId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { serviceTypeId } = req.params;

    const setting = await providerSettingsService.getSetting(userId, serviceTypeId);

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
    }

    const response: ApiResponse<ProviderSettings> = {
      success: true,
      data: setting,
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

// Create or update auto-accept rule
router.put('/auto-accept/:serviceTypeId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { serviceTypeId } = req.params;
    const { autoAcceptEnabled, minAmount, maxAmount, capabilities } = req.body;

    // Update user to be a provider if enabling auto-accept
    if (autoAcceptEnabled) {
      await userService.updateUser(userId, { isProvider: true });
    }

    const setting = await providerSettingsService.upsertSetting(
      userId,
      serviceTypeId as any,
      {
        autoAcceptEnabled: autoAcceptEnabled ?? false,
        minAmount,
        maxAmount,
        capabilities,
      }
    );

    const response: ApiResponse<ProviderSettings> = {
      success: true,
      data: setting,
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

// Delete auto-accept rule
router.delete('/auto-accept/:serviceTypeId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { serviceTypeId } = req.params;

    await providerSettingsService.deleteSetting(userId, serviceTypeId);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Setting deleted' },
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

// Toggle auto-accept on/off
router.patch('/auto-accept/:serviceTypeId/toggle', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { serviceTypeId } = req.params;
    const { enabled } = req.body;

    const setting = await providerSettingsService.toggleAutoAccept(userId, serviceTypeId, enabled);

    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
    }

    const response: ApiResponse<ProviderSettings> = {
      success: true,
      data: setting,
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

// Update user profile
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { displayName, avatarUrl, isProvider } = req.body;

    const user = await userService.updateUser(userId, {
      displayName,
      avatarUrl,
      isProvider,
    });

    const response: ApiResponse<typeof user> = {
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

// ============================================
// ORG SERVICE TYPE SETTINGS (Org Admin Only)
// ============================================

// Helper to check if user is org admin
async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT role FROM org_members WHERE user_id = $1 AND organization_id = $2`,
    [userId, orgId]
  );
  if (result.rows.length === 0) return false;
  return result.rows[0].role === 'admin';
}

// Get available service types for the current user's org
// This is the filtered list that should be shown when creating escrows
router.get('/org/service-types/available', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    // Get user's primary org
    const userResult = await pool.query(
      `SELECT primary_org_id FROM users WHERE id = $1`,
      [userId]
    );
    const orgId = userResult.rows[0]?.primary_org_id;

    if (!orgId) {
      // If no org, return all active platform service types
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

      return res.json({
        success: true,
        data: serviceTypes,
      });
    }

    const serviceTypes = await orgServiceTypeService.getAvailableServiceTypes(orgId);

    const response: ApiResponse<ServiceType[]> = {
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

// Get service types with org status (for org admin UI)
router.get('/org/:orgId/service-types', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { orgId } = req.params;

    // Check if user is admin of this org
    const isAdmin = await isOrgAdmin(userId, orgId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only organization admins can view service type settings',
      });
    }

    const serviceTypes = await orgServiceTypeService.getServiceTypesWithOrgStatus(orgId);

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

// Toggle service type enabled/disabled for org
router.patch('/org/:orgId/service-types/:serviceTypeId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { orgId, serviceTypeId } = req.params;
    const { isEnabled } = req.body;

    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isEnabled must be a boolean',
      });
    }

    // Check if user is admin of this org
    const isAdmin = await isOrgAdmin(userId, orgId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only organization admins can manage service type settings',
      });
    }

    const setting = await orgServiceTypeService.setSetting(orgId, serviceTypeId, isEnabled, userId);

    const response: ApiResponse<OrgServiceTypeSetting> = {
      success: true,
      data: setting,
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
