import { Router } from 'express';
import { accountService } from '../services/account.service.js';
import { stripeService } from '../services/stripe.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, AccountWithTotals, LedgerEntry } from '../types/index.js';

const router = Router();

// Get current user's account
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const account = await accountService.getOrCreateUserAccount(userId);

    const response: ApiResponse<AccountWithTotals> = {
      success: true,
      data: account,
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

// Get account ledger entries
router.get('/me/ledger', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const account = await accountService.getOrCreateUserAccount(userId);
    const entries = await accountService.getLedgerEntries(account.id, limit, offset);

    const response: ApiResponse<{ entries: LedgerEntry[]; account: AccountWithTotals }> = {
      success: true,
      data: { entries, account },
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

// Create deposit checkout session
router.post('/deposit', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { amount, currency = 'usd' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0',
      });
    }

    const { sessionId, url } = await stripeService.createCheckoutSession(
      userId,
      amount,
      currency
    );

    const response: ApiResponse<{ sessionId: string; checkoutUrl: string }> = {
      success: true,
      data: { sessionId, checkoutUrl: url },
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

// Verify payment session
router.get('/deposit/verify/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await stripeService.verifySession(sessionId);

    const response: ApiResponse<typeof result> = {
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

// Get payment history
router.get('/payments', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 20;

    const payments = await stripeService.getPaymentsForUser(userId, limit);

    const response: ApiResponse<typeof payments> = {
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
