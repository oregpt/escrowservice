/**
 * Bank Transfer Payment Provider (Placeholder)
 *
 * This is a placeholder for future bank transfer support.
 * When implemented, this will allow users to deposit via ACH/wire transfer.
 */

import type {
  PaymentProvider,
  ProviderInfo,
  InitiatePaymentRequest,
  PaymentSession,
  PaymentResult,
  WebhookResult,
} from '../types.js';

export class BankProvider implements PaymentProvider {
  readonly type = 'bank' as const;
  readonly name = 'Bank Transfer';
  readonly description = 'Transfer funds directly from your bank account (ACH/Wire)';
  readonly icon = 'building-columns';
  readonly enabled = false;
  readonly comingSoon = true;

  getRequiredConfig(): string[] {
    return [
      'BANK_ACCOUNT_NUMBER',
      'BANK_ROUTING_NUMBER',
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
      minAmount: 100, // Typically higher minimum for bank transfers
      supportedCurrencies: ['USD'],
    };
  }

  async initiate(_request: InitiatePaymentRequest): Promise<PaymentSession> {
    throw new Error('Bank transfers are coming soon. Please use card payment for now.');
  }

  async verify(_paymentId: string): Promise<PaymentResult> {
    throw new Error('Bank transfers are coming soon.');
  }

  async handleWebhook?(
    _payload: Buffer,
    _headers: Record<string, string>
  ): Promise<WebhookResult> {
    return { handled: false, error: 'Bank provider not implemented yet' };
  }
}

// Export singleton instance
export const bankProvider = new BankProvider();
