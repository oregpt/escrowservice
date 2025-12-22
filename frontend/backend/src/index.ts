import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRoutes, webhookRoutes } from './routes/index.js';
import { rateLimit } from './middleware/auth.middleware.js';
import { startTunnel, getTunnelStatus, reconnectTunnel, isTunnelEnabled } from './services/ssh-tunnel.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - allow multiple frontend ports for development
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5001', 'http://localhost:5002', 'http://localhost:5003', 'http://localhost:5004', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
}));

// Webhook routes need raw body for signature verification
// Mount BEFORE JSON parsing middleware
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Parse JSON for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimit(100, 60000)); // 100 requests per minute

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// SSH Tunnel status endpoint
app.get('/api/tunnel/status', (req, res) => {
  const status = getTunnelStatus();
  res.json({
    success: true,
    data: status,
  });
});

// SSH Tunnel reconnect endpoint
app.post('/api/tunnel/reconnect', async (req, res) => {
  try {
    const success = await reconnectTunnel();
    const status = getTunnelStatus();
    res.json({
      success,
      data: status,
      message: success ? 'Tunnel reconnected successfully' : 'Failed to reconnect tunnel',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API routes
app.use('/api', apiRoutes);

// Service types endpoint (public)
app.get('/api/service-types', async (req, res) => {
  try {
    const { pool } = await import('./db/connection.js');
    const result = await pool.query(
      `SELECT * FROM service_types WHERE is_active = true ORDER BY name`
    );

    const serviceTypes = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      partyADelivers: row.party_a_delivers,
      partyBDelivers: row.party_b_delivers,
      platformFeePercent: parseFloat(row.platform_fee_percent),
      autoAcceptable: row.auto_acceptable,
      requiresPartyAConfirmation: row.requires_party_a_confirmation,
      requiresPartyBConfirmation: row.requires_party_b_confirmation,
      metadataSchema: row.metadata_schema,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));

    res.json({
      success: true,
      data: serviceTypes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Traffic calculator endpoint (public)
app.get('/api/traffic/calculate', (req, res) => {
  const usdAmount = parseFloat(req.query.usd as string) || 0;
  const bytes = req.query.bytes ? parseInt(req.query.bytes as string) : null;

  // $60 per 1MB
  const USD_PER_MB = 60;
  const BYTES_PER_MB = 1_000_000;

  if (bytes !== null) {
    // Convert bytes to USD
    const usd = (bytes / BYTES_PER_MB) * USD_PER_MB;
    res.json({
      success: true,
      data: {
        bytes,
        usd: Math.round(usd * 100) / 100,
        rate: `$${USD_PER_MB} per 1MB`,
      },
    });
  } else {
    // Convert USD to bytes
    const calculatedBytes = Math.floor((usdAmount / USD_PER_MB) * BYTES_PER_MB);
    res.json({
      success: true,
      data: {
        usd: usdAmount,
        bytes: calculatedBytes,
        rate: `$${USD_PER_MB} per 1MB`,
      },
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Initialize server with tunnel
async function initializeServer() {
  // Start SSH tunnel for IP-whitelisted API calls (only if enabled)
  if (isTunnelEnabled()) {
    console.log('[Server] SSH tunnel is ENABLED, initializing...');
    const tunnelConnected = await startTunnel();

    if (tunnelConnected) {
      console.log('[Server] SSH tunnel established successfully');
    } else {
      console.warn('[Server] SSH tunnel failed to connect - check credentials');
    }
  } else {
    console.log('[Server] SSH tunnel is DISABLED (default)');
    console.log('[Server] Set SSH_TUNNEL_ENABLED=true to enable');
  }

  // Start Express server
  app.listen(PORT, () => {
    const tunnelStatus = getTunnelStatus();
    const tunnelDisplay = !tunnelStatus.enabled
      ? 'DISABLED'
      : tunnelStatus.connected
        ? `CONNECTED (${tunnelStatus.host})`
        : 'ENABLED but NOT CONNECTED';

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    ESCROW SERVICE API                     ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                             ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(40)}║
║  SSH Tunnel: ${tunnelDisplay.padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝

Endpoints:
  Health:        GET  /health
  Service Types: GET  /api/service-types
  Traffic Calc:  GET  /api/traffic/calculate?usd=60

  SSH Tunnel:
    GET  /api/tunnel/status
    POST /api/tunnel/reconnect

  Auth:
    GET  /api/auth/me
    POST /api/auth/session
    POST /api/auth/login
    POST /api/auth/logout

  Accounts:
    GET  /api/accounts/me
    GET  /api/accounts/me/ledger
    POST /api/accounts/deposit
    GET  /api/accounts/payments

  Escrows:
    POST /api/escrows
    GET  /api/escrows
    GET  /api/escrows/:id
    POST /api/escrows/:id/accept
    POST /api/escrows/:id/fund
    POST /api/escrows/:id/confirm
    POST /api/escrows/:id/cancel
    GET  /api/escrows/:id/events
    GET  /api/escrows/:id/attachments

  Organizations:
    POST /api/organizations
    GET  /api/organizations
    GET  /api/organizations/:id
    GET  /api/organizations/:id/account
    GET  /api/organizations/:id/members
    POST /api/organizations/:id/members

  Attachments:
    POST /api/attachments/escrow/:escrowId
    GET  /api/attachments/:id
    GET  /api/attachments/:id/download
    POST /api/attachments/:id/escrow

  Payments (Modular - Stripe, Crypto, Bank):
    GET  /api/payments/providers
    POST /api/payments/initiate
    GET  /api/payments/:id
    GET  /api/payments/:id/verify
    GET  /api/payments

  Webhooks:
    POST /webhooks/stripe
    POST /webhooks/crypto
`);
  });
}

// Start the server
initializeServer().catch((error) => {
  console.error('[Server] Failed to initialize:', error);
  process.exit(1);
});

export default app;

