import { Router } from 'express';
import { paymentService } from '../services/payment/index.js';
import type { ProviderType } from '../services/payment/types.js';

const router = Router();

/**
 * Generic webhook handler for all payment providers.
 * Routes to the appropriate provider based on the URL path.
 *
 * Note: These routes should NOT use JSON body parser - they need raw body
 */

// Stripe webhook handler
router.post('/stripe', async (req, res) => {
  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    }

    const result = await paymentService.handleWebhook(
      'stripe' as ProviderType,
      req.body,
      headers
    );

    if (!result.handled) {
      console.error('Stripe webhook not handled:', result.error);
      return res.status(400).json({ error: result.error });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook handler failed',
    });
  }
});

// Future: Crypto webhook handler
router.post('/crypto', async (req, res) => {
  try {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    }

    const result = await paymentService.handleWebhook(
      'crypto' as ProviderType,
      req.body,
      headers
    );

    if (!result.handled) {
      console.error('Crypto webhook not handled:', result.error);
      return res.status(400).json({ error: result.error });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Crypto webhook error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook handler failed',
    });
  }
});

export default router;
