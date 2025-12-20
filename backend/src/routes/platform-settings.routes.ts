import { Router } from 'express';
import { platformSettingsService } from '../services/platform-settings.service.js';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Get all platform settings (platform admin only)
router.get('/', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const settings = await platformSettingsService.getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get settings',
    });
  }
});

// Update platform settings (platform admin only)
router.put('/', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const userId = req.userId;
    const settings = await platformSettingsService.updateSettings(req.body, userId);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    });
  }
});

// Get a single setting (platform admin only)
router.get('/:key', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const value = await platformSettingsService.getSetting(req.params.key as any);
    res.json({ success: true, data: { key: req.params.key, value } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get setting',
    });
  }
});

// Update a single setting (platform admin only)
router.put('/:key', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const userId = req.userId;
    await platformSettingsService.updateSetting(req.params.key as any, req.body.value, userId);
    res.json({ success: true, message: 'Setting updated' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update setting',
    });
  }
});

// Reset a setting to default (platform admin only)
router.delete('/:key', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    await platformSettingsService.resetSetting(req.params.key as any);
    res.json({ success: true, message: 'Setting reset to default' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset setting',
    });
  }
});

export default router;
