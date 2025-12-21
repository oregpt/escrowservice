/**
 * Payment Module - Exports
 *
 * Main entry point for the modular payment system.
 */

// Types
export * from './types.js';

// Service
export { PaymentService, paymentService } from './payment.service.js';

// Providers (for direct access if needed)
export { StripeProvider, stripeProvider } from './providers/stripe.provider.js';
export { CryptoProvider, cryptoProvider } from './providers/crypto.provider.js';
export { BankProvider, bankProvider } from './providers/bank.provider.js';
