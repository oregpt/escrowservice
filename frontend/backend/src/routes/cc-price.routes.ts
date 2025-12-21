import { Router } from 'express';

const router = Router();

// Default CC/USD rate if Kaiko is unavailable
const DEFAULT_CC_RATE = 0.1;

// Cache for CC price (refresh every 5 minutes)
let cachedPrice: { price: number; timestamp: number; source: 'kaiko' | 'default' } | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch CC/USD price from Kaiko API
 * Uses the Synthetic Price (Spot Exchange Rate) endpoint
 */
async function fetchKaikoPrice(): Promise<{ price: number; source: 'kaiko' | 'default' }> {
  const apiKey = process.env.KAIKO_API_KEY;

  if (!apiKey) {
    console.log('[CC Price] KAIKO_API_KEY not configured, using default rate');
    return { price: DEFAULT_CC_RATE, source: 'default' };
  }

  try {
    const response = await fetch(
      'https://us.market-api.kaiko.io/v2/data/trades.v2/spot_exchange_rate/cc/usd?interval=1d',
      {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('[CC Price] Kaiko API error:', response.status, response.statusText);
      return { price: DEFAULT_CC_RATE, source: 'default' };
    }

    const data: any = await response.json();

    if (data.result === 'success' && data.data && data.data.length > 0) {
      const price = parseFloat(data.data[0].price);
      console.log('[CC Price] Fetched from Kaiko:', price);
      return { price, source: 'kaiko' };
    }

    console.log('[CC Price] No data from Kaiko, using default');
    return { price: DEFAULT_CC_RATE, source: 'default' };
  } catch (error) {
    console.error('[CC Price] Error fetching from Kaiko:', error);
    return { price: DEFAULT_CC_RATE, source: 'default' };
  }
}

/**
 * Get CC/USD price (with caching)
 */
async function getCCPrice(): Promise<{ price: number; source: 'kaiko' | 'default'; cached: boolean }> {
  const now = Date.now();

  // Return cached price if still valid
  if (cachedPrice && (now - cachedPrice.timestamp) < CACHE_DURATION_MS) {
    return { ...cachedPrice, cached: true };
  }

  // Fetch fresh price
  const { price, source } = await fetchKaikoPrice();
  cachedPrice = { price, timestamp: now, source };

  return { price, source, cached: false };
}

// GET /api/cc-price - Get current CC/USD exchange rate
router.get('/', async (req, res) => {
  try {
    const { price, source, cached } = await getCCPrice();

    res.json({
      success: true,
      data: {
        ccPriceUsd: price,           // Price of 1 CC in USD (e.g., 0.14 means 1 CC = $0.14)
        usdPerCc: price,             // Same as above, clearer name
        ccPerUsd: 1 / price,         // How many CC you get for $1 USD
        source,                      // 'kaiko' or 'default'
        cached,                      // Whether this was from cache
        defaultRate: DEFAULT_CC_RATE,
        lastUpdated: cachedPrice?.timestamp ? new Date(cachedPrice.timestamp).toISOString() : null,
      },
    });
  } catch (error) {
    console.error('[CC Price] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch CC price',
      data: {
        ccPriceUsd: DEFAULT_CC_RATE,
        usdPerCc: DEFAULT_CC_RATE,
        ccPerUsd: 1 / DEFAULT_CC_RATE,
        source: 'default',
        cached: false,
        defaultRate: DEFAULT_CC_RATE,
      },
    });
  }
});

// POST /api/cc-price/refresh - Force refresh the cached price
router.post('/refresh', async (req, res) => {
  try {
    // Clear cache to force refresh
    cachedPrice = null;
    const { price, source } = await getCCPrice();

    res.json({
      success: true,
      data: {
        ccPriceUsd: price,
        source,
        refreshed: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh CC price',
    });
  }
});

export default router;
