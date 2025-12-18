import { Router } from 'express';
import { providerSettingsService } from '../services/provider-settings.service.js';
import { userService } from '../services/user.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, ProviderSettings } from '../types/index.js';

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

export default router;
