/**
 * Registry Routes - theRegistry Tokenization API
 *
 * Endpoints for tokenizing escrows on the Canton blockchain via theRegistry platform.
 */

import { Router } from 'express';
import * as registryService from '../services/registry.service.js';
import { orgFeatureFlagsService } from '../services/org-feature-flags.service.js';
import { userService } from '../services/user.service.js';
import { escrowService } from '../services/escrow.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type {
  ApiResponse,
  OrgRegistryConfig,
  TokenizationRecordExtended,
  TokenizationResponse,
  TokenizeEscrowRequest,
  UpsertRegistryConfigRequest,
} from '../types/index.js';

const router = Router();

// ========================================
// Org Registry Config Management
// ========================================

/**
 * GET /api/registry/config
 * Get the current user's organization's registry configuration
 */
router.get('/config', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const user = await userService.getUserById(userId);

    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Check if tokenization feature is enabled
    const featureEnabled = await orgFeatureFlagsService.isFeatureEnabled(user.primaryOrgId, 'tokenization');
    if (!featureEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Tokenization feature is not enabled for your organization',
      });
    }

    const config = await registryService.getOrgRegistryConfig(user.primaryOrgId);

    // Don't expose the encrypted API key to the frontend
    const safeConfig = config ? {
      id: config.id,
      organizationId: config.organizationId,
      environment: config.environment,
      walletAddress: config.walletAddress,
      isConfigured: config.isConfigured,
      hasApiKey: !!config.apiKeyEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    } : null;

    const response: ApiResponse<typeof safeConfig> = {
      success: true,
      data: safeConfig,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting registry config:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/registry/config
 * Update the current user's organization's registry configuration
 * Requires org admin role
 */
router.put('/config', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const user = await userService.getUserById(userId);

    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Check if tokenization feature is enabled
    const featureEnabled = await orgFeatureFlagsService.isFeatureEnabled(user.primaryOrgId, 'tokenization');
    if (!featureEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Tokenization feature is not enabled for your organization',
      });
    }

    // TODO: Check if user is org admin (for now, any authenticated user can update)

    const { apiKey, environment, walletAddress }: UpsertRegistryConfigRequest = req.body;

    // Validate environment if provided
    if (environment && !['TESTNET', 'MAINNET'].includes(environment)) {
      return res.status(400).json({
        success: false,
        error: 'Environment must be TESTNET or MAINNET',
      });
    }

    const config = await registryService.upsertOrgRegistryConfig(user.primaryOrgId, {
      apiKey,
      environment,
      walletAddress,
    });

    // Don't expose the encrypted API key to the frontend
    const safeConfig = {
      id: config.id,
      organizationId: config.organizationId,
      environment: config.environment,
      walletAddress: config.walletAddress,
      isConfigured: config.isConfigured,
      hasApiKey: !!config.apiKeyEncrypted,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };

    const response: ApiResponse<typeof safeConfig> = {
      success: true,
      data: safeConfig,
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating registry config:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ========================================
// Tokenization Operations
// ========================================

/**
 * POST /api/registry/tokenize/:escrowId
 * Tokenize an escrow (first-time registration)
 */
router.post('/tokenize/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;
    const { customName, customDescription }: TokenizeEscrowRequest = req.body;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Check if tokenization feature is enabled
    const featureEnabled = await orgFeatureFlagsService.isFeatureEnabled(user.primaryOrgId, 'tokenization');
    if (!featureEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Tokenization feature is not enabled for your organization',
      });
    }

    // Verify user has access to this escrow
    const escrow = await escrowService.getEscrowById(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found',
      });
    }

    // Only party A's org can tokenize
    if (escrow.partyAOrgId !== user.primaryOrgId) {
      return res.status(403).json({
        success: false,
        error: 'Only the escrow creator organization can tokenize',
      });
    }

    // Check if can tokenize
    const canTokenizeResult = await registryService.canTokenize(escrowId, user.primaryOrgId);
    if (!canTokenizeResult.canTokenize) {
      return res.status(400).json({
        success: false,
        error: canTokenizeResult.reason,
      });
    }

    // Tokenize the escrow
    const result = await registryService.tokenizeEscrow(escrowId, user.primaryOrgId, {
      customName,
      customDescription,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    const response: ApiResponse<TokenizationResponse> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error('Error tokenizing escrow:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /api/registry/tokenize/:escrowId
 * Update tokenized escrow metadata
 */
router.patch('/tokenize/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Check if tokenization feature is enabled
    const featureEnabled = await orgFeatureFlagsService.isFeatureEnabled(user.primaryOrgId, 'tokenization');
    if (!featureEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Tokenization feature is not enabled for your organization',
      });
    }

    // Verify user has access to this escrow
    const escrow = await escrowService.getEscrowById(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found',
      });
    }

    // Only party A's org can update tokenization
    if (escrow.partyAOrgId !== user.primaryOrgId) {
      return res.status(403).json({
        success: false,
        error: 'Only the escrow creator organization can update tokenization',
      });
    }

    // Check if can update
    const canUpdateResult = await registryService.canUpdateTokenization(escrowId, user.primaryOrgId);
    if (!canUpdateResult.canUpdate) {
      return res.status(400).json({
        success: false,
        error: canUpdateResult.reason,
      });
    }

    // Update tokenization metadata
    const result = await registryService.updateTokenization(escrowId, user.primaryOrgId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    const response: ApiResponse<TokenizationResponse> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating tokenization:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/registry/status/:escrowId
 * Get tokenization status for an escrow
 */
router.get('/status/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Verify user has access to this escrow
    const escrow = await escrowService.getEscrowById(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found',
      });
    }

    // Check if user's org is party A or B
    if (escrow.partyAOrgId !== user.primaryOrgId && escrow.partyBOrgId !== user.primaryOrgId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this escrow',
      });
    }

    const record = await registryService.getTokenizationRecord(escrowId);

    const response: ApiResponse<{
      isTokenized: boolean;
      record: TokenizationRecordExtended | null;
    }> = {
      success: true,
      data: {
        // isTokenized is true if there's a record (even if sync is pending)
        // syncStatus indicates blockchain confirmation progress
        isTokenized: !!record && record.syncStatus !== 'failed',
        record,
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting tokenization status:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/registry/sync/:escrowId
 * Sync tokenization status from theRegistry (check if contract_id is now available)
 */
router.post('/sync/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Verify user has access to this escrow
    const escrow = await escrowService.getEscrowById(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found',
      });
    }

    // Check if user's org is party A or B
    if (escrow.partyAOrgId !== user.primaryOrgId && escrow.partyBOrgId !== user.primaryOrgId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this escrow',
      });
    }

    const result = await registryService.syncTokenizationStatus(escrowId, user.primaryOrgId);

    res.json({
      success: result.success,
      data: {
        updated: result.updated,
        record: result.record,
      },
      error: result.error,
    });
  } catch (error) {
    console.error('Error syncing tokenization status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/registry/push/:escrowId
 * Push asset to Canton blockchain (re-push when local-only or failed)
 */
router.post('/push/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Verify user has access to this escrow
    const escrow = await escrowService.getEscrowById(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found',
      });
    }

    // Check if user's org is party A or B
    if (escrow.partyAOrgId !== user.primaryOrgId && escrow.partyBOrgId !== user.primaryOrgId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this escrow',
      });
    }

    const result = await registryService.pushToBlockchain(escrowId, user.primaryOrgId);

    res.json({
      success: result.success,
      data: {
        pushed: result.pushed,
        record: result.record,
      },
      error: result.error,
    });
  } catch (error) {
    console.error('Error pushing to blockchain:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/registry/history/:escrowId
 * Get tokenization history for an escrow (all updates)
 */
router.get('/history/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    // Verify user has access to this escrow
    const escrow = await escrowService.getEscrowById(escrowId);
    if (!escrow) {
      return res.status(404).json({
        success: false,
        error: 'Escrow not found',
      });
    }

    // Check if user's org is party A or B
    if (escrow.partyAOrgId !== user.primaryOrgId && escrow.partyBOrgId !== user.primaryOrgId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this escrow',
      });
    }

    const history = await registryService.getTokenizationHistory(escrowId);

    const response: ApiResponse<TokenizationRecordExtended[]> = {
      success: true,
      data: history,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting tokenization history:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/registry/can-tokenize/:escrowId
 * Check if an escrow can be tokenized
 */
router.get('/can-tokenize/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    const result = await registryService.canTokenize(escrowId, user.primaryOrgId);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error('Error checking can tokenize:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/registry/can-update/:escrowId
 * Check if a tokenized escrow can be updated
 */
router.get('/can-update/:escrowId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;

    const user = await userService.getUserById(userId);
    if (!user?.primaryOrgId) {
      return res.status(400).json({
        success: false,
        error: 'User does not belong to an organization',
      });
    }

    const result = await registryService.canUpdateTokenization(escrowId, user.primaryOrgId);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    console.error('Error checking can update:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export default router;
