import { Router } from 'express';
import authRoutes from './auth.routes.js';
import accountRoutes from './account.routes.js';
import escrowRoutes from './escrow.routes.js';
import organizationRoutes from './organization.routes.js';
import attachmentRoutes from './attachment.routes.js';
import settingsRoutes from './settings.routes.js';
import adminRoutes from './admin.routes.js';
import webhookRoutes from './webhook.routes.js';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/escrows', escrowRoutes);
router.use('/organizations', organizationRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin', adminRoutes);

// Webhooks are mounted separately to handle raw body

export { router as apiRoutes, webhookRoutes };
