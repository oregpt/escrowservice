/**
 * Modular Payment Provider System - Types
 *
 * This file defines the interfaces and types for the payment provider system.
 * Each payment provider (Stripe, Crypto, Bank, etc.) implements the PaymentProvider interface.
 */

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType = 'stripe' | 'crypto' | 'bank' | 'paypal' | 'loop' | string;

export type PaymentStatus =
  | 'pending' // Awaiting user action
  | 'processing' // Payment in progress
  | 'succeeded' // Payment complete
  | 'failed' // Payment failed
  | 'canceled' // User/system canceled
  | 'expired'; // Session expired

// ============================================================================
// Provider Info (for listing available providers)
// ============================================================================

export interface ProviderInfo {
  type: ProviderType;
  name: string;
  description: string;
  icon?: string; // Icon name or URL
  enabled: boolean;
  comingSoon?: boolean;
  minAmount?: number;
  maxAmount?: number;
  supportedCurrencies?: string[];
}

// ============================================================================
// Payment Request/Response Types
// ============================================================================

export interface InitiatePaymentRequest {
  userId: string;
  amount: number;
  currency: string;
  escrowId?: string; // If funding a specific escrow
  metadata?: Record<string, any>;
}

export interface PaymentSession {
  id: string; // Internal payment ID (UUID)
  provider: ProviderType;
  externalId?: string; // Provider's ID (e.g., Stripe session ID)
  status: PaymentStatus;
  amount: number;
  currency: string;
  redirectUrl?: string; // For redirect-based flows (Stripe Checkout)
  expiresAt?: Date;
  metadata: Record<string, any>; // Provider-specific data
}

export interface PaymentResult {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  provider: ProviderType;
  completedAt?: Date;
  error?: string;
}

export interface WebhookResult {
  handled: boolean;
  paymentId?: string;
  status?: PaymentStatus;
  error?: string;
}

// ============================================================================
// Payment Provider Interface
// ============================================================================

/**
 * The contract every payment provider must implement.
 *
 * To add a new payment provider:
 * 1. Create a new file in providers/ (e.g., paypal.provider.ts)
 * 2. Implement this interface
 * 3. Register the provider in PaymentService
 */
export interface PaymentProvider {
  // Provider identification
  readonly type: ProviderType;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly enabled: boolean;
  readonly comingSoon?: boolean;

  // Payment lifecycle
  initiate(request: InitiatePaymentRequest): Promise<PaymentSession>;
  verify(paymentId: string): Promise<PaymentResult>;
  cancel?(paymentId: string): Promise<void>;

  // Webhooks (optional - not all providers use webhooks)
  handleWebhook?(
    payload: Buffer,
    headers: Record<string, string>
  ): Promise<WebhookResult>;

  // Configuration
  getRequiredConfig(): string[]; // e.g., ['STRIPE_SECRET_KEY']
  isConfigured(): boolean;

  // Provider info for frontend
  getInfo(): ProviderInfo;
}

// ============================================================================
// Database Types
// ============================================================================

export interface Payment {
  id: string;
  userId: string;
  escrowId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: ProviderType;
  externalId?: string;
  providerData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Service Request Types
// ============================================================================

export interface CreatePaymentRequest {
  provider: ProviderType;
  amount: number;
  currency?: string;
  escrowId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Loop SDK Types (Canton Wallet Funding)
// ============================================================================

export interface LoopWalletConnection {
  partyId: string;
  publicKey: string;
  email?: string;
}

export interface LoopTransferRequest {
  paymentId: string;
  cantonTxId: string;
  fromPartyId: string;
  ccAmount: string;
}

export interface LoopPaymentSession extends PaymentSession {
  providerConfig: {
    platformPartyId: string;
    ccAmount: string;
    usdAmount: number;
    exchangeRate: number;
  };
}

export interface LoopTransferRecord {
  id: string;
  paymentId: string;
  fromPartyId: string;
  toPartyId: string;
  ccAmount: string;
  usdEquivalent: number;
  exchangeRate: number;
  cantonTxId: string;
  verifiedAt?: Date;
  createdAt: Date;
}
