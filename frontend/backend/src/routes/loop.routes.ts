/**
 * Loop Payment Routes
 *
 * API endpoints for Loop SDK (Canton wallet) funding.
 * These routes support the client-side Loop SDK flow.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { loopProvider } from '../services/payment/providers/loop.provider.js';

const router = Router();

/**
 * GET /api/payments/loop/config
 * Get platform wallet info for frontend SDK initialization
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    if (!loopProvider.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Loop provider is not configured',
      });
    }

    const config = loopProvider.getConfig();
    const exchangeRate = await loopProvider.getExchangeRate();

    res.json({
      success: true,
      data: {
        ...config,
        ccToUsdRate: exchangeRate,
      },
    });
  } catch (error) {
    console.error('[Loop] Failed to get config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Loop configuration',
    });
  }
});

/**
 * POST /api/payments/loop/create-session
 * Create a pending payment session for Loop funding
 */
router.post('/create-session', requireAuth, async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'USD', escrowId, metadata } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
      });
    }

    const session = await loopProvider.initiate({
      userId,
      amount,
      currency,
      escrowId,
      metadata,
    });

    res.json({
      success: true,
      data: {
        paymentId: session.id,
        platformPartyId: session.metadata.platformPartyId,
        ccAmount: session.metadata.ccAmount,
        usdAmount: session.metadata.usdAmount,
        exchangeRate: session.metadata.exchangeRate,
        network: session.metadata.network,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('[Loop] Failed to create session:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payment session',
    });
  }
});

/**
 * POST /api/payments/loop/verify-transfer
 * Verify a completed Loop transfer and credit the account
 */
router.post('/verify-transfer', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paymentId, cantonTxId, fromPartyId, ccAmount } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Validate required fields
    if (!paymentId || !cantonTxId || !fromPartyId || !ccAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: paymentId, cantonTxId, fromPartyId, ccAmount',
      });
    }

    // Verify and complete the payment
    const result = await loopProvider.verifyAndComplete({
      paymentId,
      cantonTxId,
      fromPartyId,
      ccAmount,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        paymentId: result.paymentId,
      });
    }

    res.json({
      success: true,
      data: {
        paymentId: result.paymentId,
        message: 'Transfer verified and account credited',
      },
    });
  } catch (error) {
    console.error('[Loop] Failed to verify transfer:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Transfer verification failed',
    });
  }
});

/**
 * POST /api/payments/loop/save-wallet
 * Save user's Loop wallet connection for future use
 */
router.post('/save-wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const { partyId, publicKey, email } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!partyId) {
      return res.status(400).json({
        success: false,
        error: 'partyId is required',
      });
    }

    await loopProvider.saveWalletConnection(userId, {
      partyId,
      publicKey,
      email,
    });

    res.json({
      success: true,
      message: 'Wallet connection saved',
    });
  } catch (error) {
    console.error('[Loop] Failed to save wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save wallet connection',
    });
  }
});

/**
 * GET /api/payments/loop/wallet
 * Get user's saved Loop wallet
 */
router.get('/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const wallet = await loopProvider.getWalletConnection(userId);

    res.json({
      success: true,
      data: { wallet },
    });
  } catch (error) {
    console.error('[Loop] Failed to get wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet',
    });
  }
});

/**
 * DELETE /api/payments/loop/wallet
 * Disconnect user's Loop wallet
 */
router.delete('/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    await loopProvider.disconnectWallet(userId);

    res.json({
      success: true,
      message: 'Wallet disconnected',
    });
  } catch (error) {
    console.error('[Loop] Failed to disconnect wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect wallet',
    });
  }
});

/**
 * GET /api/payments/loop/exchange-rate
 * Get current CC/USD exchange rate
 */
router.get('/exchange-rate', async (req: Request, res: Response) => {
  try {
    const rate = await loopProvider.getExchangeRate();

    res.json({
      success: true,
      data: {
        ccToUsdRate: rate,
        usdToCcRate: 1 / rate,
      },
    });
  } catch (error) {
    console.error('[Loop] Failed to get exchange rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get exchange rate',
    });
  }
});

export default router;
