/**
 * Payment Service - Orchestrator
 *
 * This service manages all payment providers and provides a unified API
 * for initiating, verifying, and managing payments.
 */

import { pool } from '../../db/connection.js';
import type {
  PaymentProvider,
  ProviderType,
  ProviderInfo,
  CreatePaymentRequest,
  PaymentSession,
  PaymentResult,
  Payment,
  PaymentStatus,
} from './types.js';

// Import providers
import { stripeProvider } from './providers/stripe.provider.js';
import { cryptoProvider } from './providers/crypto.provider.js';
import { bankProvider } from './providers/bank.provider.js';
import { loopProvider } from './providers/loop.provider.js';

export class PaymentService {
  private providers: Map<ProviderType, PaymentProvider> = new Map();

  constructor() {
    // Register all providers
    this.registerProvider(stripeProvider);
    this.registerProvider(cryptoProvider);
    this.registerProvider(bankProvider);
    this.registerProvider(loopProvider);
  }

  /**
   * Register a payment provider
   */
  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.type, provider);
    console.log(
      `[PaymentService] Registered provider: ${provider.type} (enabled: ${provider.enabled})`
    );
  }

  /**
   * Get a specific provider
   */
  getProvider(type: ProviderType): PaymentProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all available providers (for frontend display)
   */
  getAvailableProviders(): ProviderInfo[] {
    const providers: ProviderInfo[] = [];

    for (const provider of this.providers.values()) {
      providers.push(provider.getInfo());
    }

    // Sort: enabled first, then by name
    return providers.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (a.comingSoon !== b.comingSoon) return a.comingSoon ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Initiate a payment with a specific provider
   */
  async initiate(
    userId: string,
    request: CreatePaymentRequest
  ): Promise<PaymentSession> {
    const provider = this.providers.get(request.provider);

    if (!provider) {
      throw new Error(`Unknown payment provider: ${request.provider}`);
    }

    if (!provider.enabled) {
      if (provider.comingSoon) {
        throw new Error(`${provider.name} is coming soon. Please use another payment method.`);
      }
      throw new Error(`${provider.name} is not available at this time.`);
    }

    return provider.initiate({
      userId,
      amount: request.amount,
      currency: request.currency || 'USD',
      escrowId: request.escrowId,
      metadata: request.metadata,
    });
  }

  /**
   * Verify a payment status
   */
  async verify(paymentId: string): Promise<PaymentResult> {
    // Get payment from database to find provider
    const result = await pool.query(
      'SELECT provider FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const providerType = result.rows[0].provider as ProviderType;
    const provider = this.providers.get(providerType);

    if (!provider) {
      throw new Error(`Unknown payment provider: ${providerType}`);
    }

    return provider.verify(paymentId);
  }

  /**
   * Handle a webhook from a specific provider
   */
  async handleWebhook(
    providerType: ProviderType,
    payload: Buffer,
    headers: Record<string, string>
  ): Promise<{ handled: boolean; error?: string }> {
    const provider = this.providers.get(providerType);

    if (!provider) {
      return { handled: false, error: `Unknown provider: ${providerType}` };
    }

    if (!provider.handleWebhook) {
      return { handled: false, error: `Provider ${providerType} does not support webhooks` };
    }

    return provider.handleWebhook(payload, headers);
  }

  /**
   * Get a payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment | null> {
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPayment(result.rows[0]);
  }

  /**
   * Get payment by external ID (provider's ID)
   */
  async getPaymentByExternalId(externalId: string): Promise<Payment | null> {
    const result = await pool.query(
      'SELECT * FROM payments WHERE external_id = $1',
      [externalId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToPayment(result.rows[0]);
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Payment[]> {
    const result = await pool.query(
      `SELECT * FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(this.mapRowToPayment);
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus
  ): Promise<void> {
    const updates: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: any[] = [status, paymentId];

    if (status === 'succeeded') {
      updates.push('completed_at = NOW()');
    }

    await pool.query(
      `UPDATE payments SET ${updates.join(', ')} WHERE id = $2`,
      values
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private mapRowToPayment(row: any): Payment {
    return {
      id: row.id,
      userId: row.user_id,
      escrowId: row.escrow_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status as PaymentStatus,
      provider: row.provider as ProviderType,
      externalId: row.external_id,
      providerData: row.provider_data || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
