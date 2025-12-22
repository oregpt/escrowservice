import { Router } from 'express';
import { userTrafficConfigService } from '../services/user-traffic-config.service.js';
import { orgFeatureFlagsService } from '../services/org-feature-flags.service.js';
import { userService } from '../services/user.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, UserTrafficConfig, UpsertTrafficConfigRequest } from '../types/index.js';

const router = Router();

// Get current user's traffic config
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    // Check if user has traffic_buyer feature enabled for their org
    const user = await userService.getUserById(userId);
    if (user?.primaryOrgId) {
      const enabled = await orgFeatureFlagsService.isFeatureEnabled(user.primaryOrgId, 'traffic_buyer');
      if (!enabled) {
        return res.status(403).json({
          success: false,
          error: 'Traffic buyer feature is not enabled for your organization',
        });
      }
    }

    const config = await userTrafficConfigService.getConfig(userId);

    const response: ApiResponse<UserTrafficConfig | null> = {
      success: true,
      data: config,
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

// Create or update traffic config
router.put('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { walletValidatorUrl, domainId }: UpsertTrafficConfigRequest = req.body;

    // Check if user has traffic_buyer feature enabled for their org
    const user = await userService.getUserById(userId);
    if (user?.primaryOrgId) {
      const enabled = await orgFeatureFlagsService.isFeatureEnabled(user.primaryOrgId, 'traffic_buyer');
      if (!enabled) {
        return res.status(403).json({
          success: false,
          error: 'Traffic buyer feature is not enabled for your organization',
        });
      }
    }

    // Validate required fields
    if (!walletValidatorUrl || !domainId) {
      return res.status(400).json({
        success: false,
        error: 'walletValidatorUrl and domainId are required',
      });
    }

    // Validate URL format
    try {
      new URL(walletValidatorUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'walletValidatorUrl must be a valid URL',
      });
    }

    const config = await userTrafficConfigService.upsertConfig(userId, {
      walletValidatorUrl,
      domainId,
    });

    const response: ApiResponse<UserTrafficConfig> = {
      success: true,
      data: config,
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

// Delete traffic config
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    await userTrafficConfigService.deleteConfig(userId);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Traffic config deleted' },
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
