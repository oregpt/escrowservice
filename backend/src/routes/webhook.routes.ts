import { Router } from 'express';
import { stripeService } from '../services/stripe.service.js';

const router = Router();

// Stripe webhook handler
// Note: This route should NOT use JSON body parser - it needs raw body
router.post('/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // req.body should be the raw buffer (configured in main app)
    await stripeService.handleWebhook(req.body, signature);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Webhook handler failed',
    });
  }
});

export default router;
