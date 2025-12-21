import { Router } from 'express';
import { templateService, CreateTemplateInput, UpdateTemplateInput } from '../services/template.service.js';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// Get all templates for current user (includes platform templates)
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const templates = await templateService.getTemplatesForUser(userId);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('[Templates] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch templates',
    });
  }
});

// Get user's own templates only
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const templates = await templateService.getUserTemplates(userId);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('[Templates] Error fetching user templates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch templates',
    });
  }
});

// Get platform templates only (public)
router.get('/platform', async (req, res) => {
  try {
    const templates = await templateService.getPlatformTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('[Templates] Error fetching platform templates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch templates',
    });
  }
});

// Get a single template by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const template = await templateService.getTemplateById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[Templates] Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch template',
    });
  }
});

// Create a new user template
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const input: CreateTemplateInput = {
      name: req.body.name,
      description: req.body.description,
      serviceTypeId: req.body.serviceTypeId,
      isPlatformTemplate: false, // Users can only create personal templates
      config: req.body.config || {},
    };

    if (!input.name) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required',
      });
    }

    const template = await templateService.createTemplate(userId, input);

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[Templates] Error creating template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create template',
    });
  }
});

// Create a platform template (admin only)
router.post('/platform', requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const userId = req.userId!;
    const input: CreateTemplateInput = {
      name: req.body.name,
      description: req.body.description,
      serviceTypeId: req.body.serviceTypeId,
      isPlatformTemplate: true,
      config: req.body.config || {},
    };

    if (!input.name) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required',
      });
    }

    const template = await templateService.createTemplate(userId, input);

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[Templates] Error creating platform template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create template',
    });
  }
});

// Update a template
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const isAdmin = req.userRole === 'platform_admin';
    const input: UpdateTemplateInput = {
      name: req.body.name,
      description: req.body.description,
      serviceTypeId: req.body.serviceTypeId,
      config: req.body.config,
    };

    const template = await templateService.updateTemplate(req.params.id, userId, input, isAdmin);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or access denied',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[Templates] Error updating template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update template',
    });
  }
});

// Delete a template
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const isAdmin = req.userRole === 'platform_admin';

    const deleted = await templateService.deleteTemplate(req.params.id, userId, isAdmin);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Template not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'Template deleted',
    });
  } catch (error) {
    console.error('[Templates] Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete template',
    });
  }
});

// Record template usage (when creating escrow from template)
router.post('/:id/use', requireAuth, async (req, res) => {
  try {
    await templateService.recordTemplateUsage(req.params.id);

    res.json({
      success: true,
      message: 'Usage recorded',
    });
  } catch (error) {
    console.error('[Templates] Error recording usage:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record usage',
    });
  }
});

export default router;
