import { Router } from 'express';
import authRoutes from './auth.routes.js';
import accountRoutes from './account.routes.js';
import escrowRoutes from './escrow.routes.js';
import organizationRoutes from './organization.routes.js';
import attachmentRoutes from './attachment.routes.js';
import settingsRoutes from './settings.routes.js';
import adminRoutes from './admin.routes.js';
import platformSettingsRoutes from './platform-settings.routes.js';
import paymentRoutes from './payment.routes.js';
import webhookRoutes from './webhook.routes.js';
import templateRoutes from './template.routes.js';
import ccPriceRoutes from './cc-price.routes.js';
import trafficConfigRoutes from './traffic-config.routes.js';
import registryRoutes from './registry.routes.js';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/escrows', escrowRoutes);
router.use('/organizations', organizationRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/platform-settings', platformSettingsRoutes);
router.use('/platform-settings', platformSettingsRoutes);
router.use('/payments', paymentRoutes);
router.use('/templates', templateRoutes);
router.use('/cc-price', ccPriceRoutes);
router.use('/traffic-config', trafficConfigRoutes);
router.use('/registry', registryRoutes);

// Webhooks are mounted separately to handle raw body

export { router as apiRoutes, webhookRoutes };
