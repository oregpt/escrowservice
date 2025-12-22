import { Router } from 'express';
import { userTrafficConfigService } from '../services/user-traffic-config.service.js';
import { orgFeatureFlagsService } from '../services/org-feature-flags.service.js';
import { userService } from '../services/user.service.js';
import { cantonTrafficService } from '../services/canton-traffic.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, UserTrafficConfig, UpsertTrafficConfigRequest, TrafficPurchaseResponse } from '../types/index.js';

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

// ========================================
// Standalone Traffic Purchase (No Escrow)
// ========================================

// Execute standalone traffic purchase
router.post('/execute', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const {
      receivingValidatorPartyId,
      trafficAmountBytes,
      bearerToken,
      iapCookie
    } = req.body;

    // Validate required fields
    if (!receivingValidatorPartyId || typeof receivingValidatorPartyId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'receivingValidatorPartyId is required',
      });
    }

    if (!trafficAmountBytes || typeof trafficAmountBytes !== 'number' || trafficAmountBytes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'trafficAmountBytes must be a positive number',
      });
    }

    if (!bearerToken || typeof bearerToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bearer token is required',
      });
    }

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

    // Get user's traffic config
    const trafficConfig = await userTrafficConfigService.getConfig(userId);
    if (!trafficConfig) {
      return res.status(400).json({
        success: false,
        error: 'Please configure your traffic settings first (wallet URL and domain ID)',
      });
    }

    // Execute the standalone traffic purchase
    const result = await cantonTrafficService.executeStandaloneTrafficPurchase({
      userId,
      walletValidatorUrl: trafficConfig.walletValidatorUrl,
      domainId: trafficConfig.domainId,
      receivingValidatorPartyId,
      trafficAmountBytes,
      bearerToken,
      iapCookie,
    });

    const response: ApiResponse<TrafficPurchaseResponse> = {
      success: true,
      data: result,
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

// Check traffic purchase status (standalone)
router.post('/check-status', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { trackingId, bearerToken, iapCookie } = req.body;

    // Validate required fields
    if (!trackingId || typeof trackingId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'trackingId is required',
      });
    }

    if (!bearerToken || typeof bearerToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Bearer token is required',
      });
    }

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

    // Get user's traffic config
    const trafficConfig = await userTrafficConfigService.getConfig(userId);
    if (!trafficConfig) {
      return res.status(400).json({
        success: false,
        error: 'Please configure your traffic settings first (wallet URL and domain ID)',
      });
    }

    // Check status via Canton API
    const statusResult = await cantonTrafficService.checkTrafficPurchaseStatus({
      walletValidatorUrl: trafficConfig.walletValidatorUrl,
      trackingId,
      bearerToken,
      iapCookie,
    });

    const response: ApiResponse<{ trackingId: string; cantonStatus: any }> = {
      success: true,
      data: {
        trackingId,
        cantonStatus: statusResult.data,
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

export default router;
