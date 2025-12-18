import Stripe from 'stripe';
import { pool, withTransaction } from '../db/connection.js';
import { accountService } from './account.service.js';
import type { StripePayment, StripePaymentStatus } from '../types/index.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export class StripeService {
  // Create checkout session for account deposit
  async createCheckoutSession(
    userId: string,
    amount: number,
    currency: string = 'usd',
    escrowId?: string
  ): Promise<{ sessionId: string; url: string }> {
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
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
      },
    });

    // Record payment intent
    await pool.query(
      `INSERT INTO stripe_payments (stripe_checkout_session_id, user_id, escrow_id, amount, currency, status, metadata)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
      [
        session.id,
        userId,
        escrowId || null,
        amount,
        currency.toUpperCase(),
        JSON.stringify({ type: escrowId ? 'escrow_funding' : 'account_deposit' }),
      ]
    );

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  // Handle Stripe webhook events
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await this.handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        // Already handled by checkout.session.completed
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
    }
  }

  // Handle successful checkout
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    return withTransaction(async (client) => {
      const userId = session.metadata?.userId;
      const escrowId = session.metadata?.escrowId || null;
      const amount = (session.amount_total || 0) / 100; // Convert from cents

      if (!userId) {
        throw new Error('No userId in checkout session metadata');
      }

      // Update payment record
      await client.query(
        `UPDATE stripe_payments
         SET status = 'succeeded', stripe_payment_intent_id = $1, updated_at = NOW()
         WHERE stripe_checkout_session_id = $2`,
        [session.payment_intent, session.id]
      );

      // Get or create user account
      const account = await accountService.getOrCreateUserAccount(userId);

      // Deposit to account
      await accountService.deposit(
        account.id,
        amount,
        escrowId ? 'escrow' : 'stripe',
        escrowId || session.id,
        `Stripe payment: ${session.payment_intent}`
      );
    });
  }

  // Handle expired checkout
  private async handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
    await pool.query(
      `UPDATE stripe_payments
       SET status = 'canceled', updated_at = NOW()
       WHERE stripe_checkout_session_id = $1`,
      [session.id]
    );
  }

  // Handle failed payment
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await pool.query(
      `UPDATE stripe_payments
       SET status = 'failed', updated_at = NOW()
       WHERE stripe_payment_intent_id = $1`,
      [paymentIntent.id]
    );
  }

  // Get payment by checkout session ID
  async getPaymentBySessionId(sessionId: string): Promise<StripePayment | null> {
    const result = await pool.query(
      `SELECT * FROM stripe_payments WHERE stripe_checkout_session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToStripePayment(result.rows[0]);
  }

  // Get payments for user
  async getPaymentsForUser(userId: string, limit: number = 20): Promise<StripePayment[]> {
    const result = await pool.query(
      `SELECT * FROM stripe_payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(this.mapRowToStripePayment);
  }

  // Verify checkout session status
  async verifySession(sessionId: string): Promise<{
    status: 'complete' | 'expired' | 'open';
    payment: StripePayment | null;
  }> {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const payment = await this.getPaymentBySessionId(sessionId);

    return {
      status: session.status as 'complete' | 'expired' | 'open',
      payment,
    };
  }

  // Helper: Map DB row to StripePayment
  private mapRowToStripePayment(row: any): StripePayment {
    return {
      id: row.id,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      stripeCheckoutSessionId: row.stripe_checkout_session_id,
      userId: row.user_id,
      escrowId: row.escrow_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status as StripePaymentStatus,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const stripeService = new StripeService();
