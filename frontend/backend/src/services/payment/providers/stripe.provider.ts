/**
 * Stripe Payment Provider
 *
 * Implements the PaymentProvider interface for Stripe payments.
 * Uses Stripe Checkout for a redirect-based payment flow.
 */

import Stripe from 'stripe';
import { pool } from '../../../db/connection.js';
import type {
  PaymentProvider,
  ProviderInfo,
  InitiatePaymentRequest,
  PaymentSession,
  PaymentResult,
  WebhookResult,
  PaymentStatus,
} from '../types.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

export class StripeProvider implements PaymentProvider {
  readonly type = 'stripe' as const;
  readonly name = 'Credit/Debit Card';
  readonly description = 'Pay securely with your credit or debit card via Stripe';
  readonly icon = 'credit-card';
  readonly comingSoon = false;

  private stripe: Stripe | null = null;

  constructor() {
    if (this.isConfigured()) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2024-12-18.acacia' as any,
      });
    }
  }

  get enabled(): boolean {
    return this.isConfigured();
  }

  getRequiredConfig(): string[] {
    return ['STRIPE_SECRET_KEY']; // Webhook secret is optional (for production webhooks)
  }

  isConfigured(): boolean {
    // Only require secret key - webhook secret is optional
    return !!process.env.STRIPE_SECRET_KEY;
  }

  isWebhookConfigured(): boolean {
    return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  }

  getInfo(): ProviderInfo {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      icon: this.icon,
      enabled: this.enabled,
      comingSoon: this.comingSoon,
      minAmount: 0.5, // Stripe minimum
      maxAmount: 999999.99,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
    };
  }

  async initiate(request: InitiatePaymentRequest): Promise<PaymentSession> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const { userId, amount, currency, escrowId, metadata } = request;

    // Create Stripe checkout session
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: escrowId ? 'Escrow Funding' : 'Account Deposit',
              description: escrowId
                ? `Funding for escrow ${escrowId}`
                : 'Deposit to your escrow account',
            },
            unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/payment/cancel`,
      metadata: {
        userId,
        escrowId: escrowId || '',
        type: escrowId ? 'escrow_funding' : 'account_deposit',
        ...metadata,
      },
    });

    // Create internal payment record
    const result = await pool.query(
      `INSERT INTO payments (user_id, escrow_id, amount, currency, status, provider, external_id, provider_data)
       VALUES ($1, $2, $3, $4, 'pending', 'stripe', $5, $6)
       RETURNING id`,
      [
        userId,
        escrowId || null,
        amount,
        currency.toUpperCase(),
        session.id,
        JSON.stringify({
          checkoutSessionId: session.id,
          type: escrowId ? 'escrow_funding' : 'account_deposit',
        }),
      ]
    );

    const paymentId = result.rows[0].id;

    return {
      id: paymentId,
      provider: this.type,
      externalId: session.id,
      status: 'pending',
      amount,
      currency: currency.toUpperCase(),
      redirectUrl: session.url!,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiry
      metadata: {
        checkoutSessionId: session.id,
      },
    };
  }

  async verify(paymentId: string): Promise<PaymentResult> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // Get payment from database
    const paymentResult = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];

    // Verify with Stripe
    const session = await this.stripe.checkout.sessions.retrieve(
      payment.external_id
    );

    const status = this.mapStripeStatus(session.status);

    // Update local record if status changed
    if (status !== payment.status) {
      await pool.query(
        `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, paymentId]
      );
    }

    return {
      id: paymentId,
      status,
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      provider: this.type,
      completedAt: status === 'succeeded' ? new Date() : undefined,
    };
  }

  async handleWebhook(
    payload: Buffer,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    if (!this.stripe) {
      return { handled: false, error: 'Stripe is not configured' };
    }

    if (!this.isWebhookConfigured()) {
      return { handled: false, error: 'Stripe webhook secret not configured' };
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const signature = headers['stripe-signature'];

    if (!signature) {
      return { handled: false, error: 'Missing stripe-signature header' };
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      return { handled: false, error: 'Webhook signature verification failed' };
    }

    switch (event.type) {
      case 'checkout.session.completed':
        return await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
      case 'checkout.session.expired':
        return await this.handleCheckoutExpired(
          event.data.object as Stripe.Checkout.Session
        );
      case 'payment_intent.payment_failed':
        return await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent
        );
      default:
        return { handled: true }; // Acknowledge but don't process
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private mapStripeStatus(
    stripeStatus: string | null
  ): PaymentStatus {
    switch (stripeStatus) {
      case 'complete':
        return 'succeeded';
      case 'expired':
        return 'expired';
      case 'open':
        return 'pending';
      default:
        return 'pending';
    }
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session
  ): Promise<WebhookResult> {
    const userId = session.metadata?.userId;
    const escrowId = session.metadata?.escrowId || null;
    const amount = (session.amount_total || 0) / 100;

    if (!userId) {
      return { handled: false, error: 'No userId in session metadata' };
    }

    // Update payment record
    const result = await pool.query(
      `UPDATE payments
       SET status = 'succeeded',
           completed_at = NOW(),
           updated_at = NOW(),
           provider_data = provider_data || $1
       WHERE external_id = $2
       RETURNING id`,
      [
        JSON.stringify({ paymentIntentId: session.payment_intent }),
        session.id,
      ]
    );

    if (result.rows.length === 0) {
      return { handled: false, error: 'Payment record not found' };
    }

    const paymentId = result.rows[0].id;

    // Credit user's account (import accountService at runtime to avoid circular deps)
    const { accountService } = await import('../../account.service.js');
    const account = await accountService.getOrCreateAccountForUser(userId);
    await accountService.deposit(
      account.id,
      amount,
      escrowId ? 'escrow' : 'stripe',
      escrowId || session.id,
      `Stripe payment: ${session.payment_intent}`
    );

    return {
      handled: true,
      paymentId,
      status: 'succeeded',
    };
  }

  private async handleCheckoutExpired(
    session: Stripe.Checkout.Session
  ): Promise<WebhookResult> {
    const result = await pool.query(
      `UPDATE payments
       SET status = 'expired', updated_at = NOW()
       WHERE external_id = $1
       RETURNING id`,
      [session.id]
    );

    return {
      handled: true,
      paymentId: result.rows[0]?.id,
      status: 'expired',
    };
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<WebhookResult> {
    // Find by payment intent ID in provider_data
    const result = await pool.query(
      `UPDATE payments
       SET status = 'failed', updated_at = NOW()
       WHERE provider_data->>'paymentIntentId' = $1
       RETURNING id`,
      [paymentIntent.id]
    );

    return {
      handled: true,
      paymentId: result.rows[0]?.id,
      status: 'failed',
    };
  }
}

// Export singleton instance
export const stripeProvider = new StripeProvider();
