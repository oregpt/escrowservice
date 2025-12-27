/**
 * Loop Payment Provider
 *
 * Implements the PaymentProvider interface for Loop SDK (Canton wallet) payments.
 * Unlike Stripe, Loop uses a client-side SDK flow - no redirects, transfers happen in-app.
 */

import { pool } from '../../../db/connection.js';
import type {
  PaymentProvider,
  ProviderInfo,
  InitiatePaymentRequest,
  PaymentSession,
  PaymentResult,
  PaymentStatus,
  LoopWalletConnection,
  LoopTransferRequest,
} from '../types.js';

// Platform wallet to receive all Loop payments (read at runtime, not module load)
function getPlatformPartyId(): string {
  return process.env.LOOP_PLATFORM_PARTY_ID || '';
}
function getLoopNetwork(): string {
  return process.env.LOOP_NETWORK || 'mainnet';
}

export class LoopProvider implements PaymentProvider {
  readonly type = 'loop' as const;
  readonly name = 'Canton Wallet (Loop)';
  readonly description = 'Pay with CC tokens from your Canton wallet';
  readonly icon = 'wallet';
  readonly comingSoon = false;

  get enabled(): boolean {
    return this.isConfigured();
  }

  getRequiredConfig(): string[] {
    return ['LOOP_PLATFORM_PARTY_ID'];
  }

  isConfigured(): boolean {
    return !!getPlatformPartyId();
  }

  getInfo(): ProviderInfo {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      icon: this.icon,
      enabled: this.enabled,
      comingSoon: this.comingSoon,
      minAmount: 0.01,
      maxAmount: 1000000,
      supportedCurrencies: ['USD'], // Display in USD, settle in CC
    };
  }

  /**
   * Get current CC/USD exchange rate from Kaiko
   */
  async getExchangeRate(): Promise<number> {
    try {
      // Use the existing cc-price endpoint internally
      const response = await fetch('http://localhost:' + (process.env.PORT || 5001) + '/api/cc-price');
      if (response.ok) {
        const data = await response.json();
        return data.data?.ccPriceUsd || 0.1; // Default to 0.1 if not available
      }
    } catch (error) {
      console.warn('[Loop] Failed to fetch CC price, using default:', error);
    }
    return 0.1; // Default rate if Kaiko unavailable
  }

  /**
   * Create a pending payment session for Loop funding.
   * Returns platform wallet info + CC amount for the frontend SDK.
   */
  async initiate(request: InitiatePaymentRequest): Promise<PaymentSession> {
    if (!this.isConfigured()) {
      throw new Error('Loop provider is not configured');
    }

    const { userId, amount, currency, escrowId, metadata } = request;

    // Get current exchange rate
    const exchangeRate = await this.getExchangeRate();
    const ccAmount = (amount / exchangeRate).toFixed(8);

    // Create pending payment record
    const result = await pool.query(
      `INSERT INTO payments (user_id, escrow_id, amount, currency, status, provider, provider_data)
       VALUES ($1, $2, $3, $4, 'pending', 'loop', $5)
       RETURNING id`,
      [
        userId,
        escrowId || null,
        amount,
        currency.toUpperCase(),
        JSON.stringify({
          cc_amount: ccAmount,
          exchange_rate: exchangeRate,
          platform_party_id: getPlatformPartyId(),
          network: getLoopNetwork(),
          type: escrowId ? 'escrow_funding' : 'account_deposit',
          ...metadata,
        }),
      ]
    );

    const paymentId = result.rows[0].id;

    return {
      id: paymentId,
      provider: this.type,
      status: 'pending',
      amount,
      currency: currency.toUpperCase(),
      // No redirect URL - frontend handles SDK
      redirectUrl: undefined,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
      metadata: {
        platformPartyId: getPlatformPartyId(),
        ccAmount,
        usdAmount: amount,
        exchangeRate,
        network: getLoopNetwork(),
      },
    };
  }

  /**
   * Verify a payment by checking its status
   */
  async verify(paymentId: string): Promise<PaymentResult> {
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [paymentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = result.rows[0];

    return {
      id: paymentId,
      status: payment.status as PaymentStatus,
      amount: parseFloat(payment.amount),
      currency: payment.currency,
      provider: this.type,
      completedAt: payment.completed_at,
    };
  }

  /**
   * Verify and complete a Loop transfer.
   * Called by frontend after loop.wallet.transfer() succeeds.
   */
  async verifyAndComplete(request: LoopTransferRequest): Promise<{
    success: boolean;
    paymentId: string;
    error?: string;
  }> {
    const { paymentId, cantonTxId, fromPartyId, ccAmount } = request;

    // Get the pending payment
    const paymentResult = await pool.query(
      `SELECT * FROM payments WHERE id = $1 AND provider = 'loop' AND status = 'pending'`,
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      return {
        success: false,
        paymentId,
        error: 'Payment not found or already processed',
      };
    }

    const payment = paymentResult.rows[0];
    const providerData = payment.provider_data;
    const expectedCcAmount = providerData.cc_amount;

    // TODO: In production, verify the transfer on the Canton ledger
    // For now, we trust the frontend but record everything for audit
    // The verification would query Loop/Canton API to confirm the transfer

    // Verify amount matches (with small tolerance for rounding)
    const amountDiff = Math.abs(parseFloat(ccAmount) - parseFloat(expectedCcAmount));
    if (amountDiff > 0.00000001) {
      await pool.query(
        `UPDATE payments SET status = 'failed',
         provider_data = provider_data || $1,
         updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            amount_mismatch: true,
            expected: expectedCcAmount,
            received: ccAmount,
          }),
          paymentId,
        ]
      );

      return {
        success: false,
        paymentId,
        error: 'Transfer amount does not match expected amount',
      };
    }

    // Record the transfer
    await pool.query(
      `INSERT INTO loop_transfers (
        payment_id, from_party_id, to_party_id, cc_amount,
        usd_equivalent, exchange_rate, canton_tx_id, verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        paymentId,
        fromPartyId,
        getPlatformPartyId(),
        ccAmount,
        payment.amount,
        providerData.exchange_rate,
        cantonTxId,
      ]
    );

    // Update payment as completed
    await pool.query(
      `UPDATE payments SET
        status = 'succeeded',
        external_id = $1,
        completed_at = NOW(),
        updated_at = NOW(),
        provider_data = provider_data || $2
       WHERE id = $3`,
      [
        cantonTxId,
        JSON.stringify({
          verified_at: new Date().toISOString(),
          from_party_id: fromPartyId,
          canton_tx_id: cantonTxId,
        }),
        paymentId,
      ]
    );

    // Credit user's account
    const { accountService } = await import('../../account.service.js');
    const account = await accountService.getOrCreateAccountForUser(payment.user_id);
    await accountService.deposit(
      account.id,
      parseFloat(payment.amount),
      'loop',
      paymentId,
      `Loop payment: ${cantonTxId.slice(0, 16)}...`
    );

    return {
      success: true,
      paymentId,
    };
  }

  /**
   * Save user's Loop wallet connection for future use
   */
  async saveWalletConnection(
    userId: string,
    wallet: LoopWalletConnection
  ): Promise<void> {
    await pool.query(
      `INSERT INTO user_loop_wallets (user_id, party_id, public_key, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, party_id)
       DO UPDATE SET
         public_key = EXCLUDED.public_key,
         email = EXCLUDED.email,
         last_used_at = NOW(),
         is_active = TRUE`,
      [userId, wallet.partyId, wallet.publicKey, wallet.email]
    );
  }

  /**
   * Get user's saved Loop wallet
   */
  async getWalletConnection(userId: string): Promise<LoopWalletConnection | null> {
    const result = await pool.query(
      `SELECT party_id, public_key, email
       FROM user_loop_wallets
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY last_used_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    return {
      partyId: result.rows[0].party_id,
      publicKey: result.rows[0].public_key,
      email: result.rows[0].email,
    };
  }

  /**
   * Disconnect user's Loop wallet
   */
  async disconnectWallet(userId: string): Promise<void> {
    await pool.query(
      `UPDATE user_loop_wallets SET is_active = FALSE WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Get Loop configuration for frontend
   */
  getConfig(): {
    platformPartyId: string;
    network: string;
    supportedInstruments: string[];
  } {
    return {
      platformPartyId: getPlatformPartyId(),
      network: getLoopNetwork(),
      supportedInstruments: ['CC'], // Canton Coin
    };
  }
}

// Export singleton instance
export const loopProvider = new LoopProvider();
