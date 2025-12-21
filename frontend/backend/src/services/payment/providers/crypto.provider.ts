/**
 * Crypto Wallet Payment Provider (Placeholder)
 *
 * This is a placeholder for future cryptocurrency payment support.
 * When implemented, this will allow users to deposit via crypto wallets.
 */

import type {
  PaymentProvider,
  ProviderInfo,
  InitiatePaymentRequest,
  PaymentSession,
  PaymentResult,
  WebhookResult,
} from '../types.js';

export class CryptoProvider implements PaymentProvider {
  readonly type = 'crypto' as const;
  readonly name = 'Crypto Wallet';
  readonly description = 'Pay with cryptocurrency (Bitcoin, Ethereum, USDC)';
  readonly icon = 'bitcoin';
  readonly enabled = false;
  readonly comingSoon = true;

  getRequiredConfig(): string[] {
    return [
      'CRYPTO_WALLET_ADDRESS',
      'CRYPTO_WEBHOOK_SECRET',
      // Add more when implementing
    ];
  }

  isConfigured(): boolean {
    // Not configured yet - coming soon
    return false;
  }

  getInfo(): ProviderInfo {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      icon: this.icon,
      enabled: this.enabled,
      comingSoon: this.comingSoon,
      supportedCurrencies: ['BTC', 'ETH', 'USDC', 'USDT'],
    };
  }

  async initiate(_request: InitiatePaymentRequest): Promise<PaymentSession> {
    throw new Error('Crypto payments are coming soon. Please use card payment for now.');
  }

  async verify(_paymentId: string): Promise<PaymentResult> {
    throw new Error('Crypto payments are coming soon.');
  }

  async handleWebhook?(
    _payload: Buffer,
    _headers: Record<string, string>
  ): Promise<WebhookResult> {
    return { handled: false, error: 'Crypto provider not implemented yet' };
  }
}

// Export singleton instance
export const cryptoProvider = new CryptoProvider();
