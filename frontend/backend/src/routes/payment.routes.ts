/**
 * Payment Routes - Unified Payment API
 *
 * Provides a provider-agnostic API for payment operations.
 * Supports multiple payment providers (Stripe, Crypto, Bank, etc.)
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { paymentService } from '../services/payment/index.js';
import type { ApiResponse } from '../types/index.js';
import type {
  ProviderInfo,
  PaymentSession,
  PaymentResult,
  Payment,
} from '../services/payment/types.js';

const router = Router();

// ============================================================================
// Get Available Payment Providers
// ============================================================================

router.get('/providers', async (_req, res) => {
  try {
    const providers = paymentService.getAvailableProviders();

    const response: ApiResponse<ProviderInfo[]> = {
      success: true,
      data: providers,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// Initiate Payment
// ============================================================================

router.post('/initiate', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { provider, amount, currency, escrowId, metadata } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Payment provider is required',
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0',
      });
    }

    const session = await paymentService.initiate(userId, {
      provider,
      amount,
      currency: currency || 'USD',
      escrowId,
      metadata,
    });

    const response: ApiResponse<PaymentSession> = {
      success: true,
      data: session,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// ============================================================================
// Get Payment by ID
// ============================================================================

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await paymentService.getPayment(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    // Verify user owns this payment
    if (payment.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const response: ApiResponse<Payment> = {
      success: true,
      data: payment,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// Verify Payment Status
// ============================================================================

router.get('/:id/verify', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check payment exists and belongs to user
    const payment = await paymentService.getPayment(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    if (payment.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    const result = await paymentService.verify(id);

    const response: ApiResponse<PaymentResult> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// ============================================================================
// Get Payment History
// ============================================================================

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const payments = await paymentService.getPaymentHistory(userId, limit, offset);

    const response: ApiResponse<Payment[]> = {
      success: true,
      data: payments,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

export default router;
