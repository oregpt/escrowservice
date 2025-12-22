import { pool, withTransaction } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import type { CantonTrafficRequest, TrafficBuyMetadata, TrafficPurchaseParams, TrafficPurchaseResponse } from '../types/index.js';
import { proxiedPost, isTunnelConnected, getTunnelStatus } from './proxied-http.js';

const CANTON_WALLET_API_URL = process.env.CANTON_WALLET_API_URL || 'https://wallet.sv-2.us.cantoncloud.dev.global.canton.network.sync.global';

// Traffic pricing: $60 per 1MB (1,000,000 bytes)
const USD_PER_MB = 60;
const BYTES_PER_MB = 1_000_000;

export class CantonTrafficService {
  // Calculate bytes from USD amount
  calculateBytesFromUsd(usdAmount: number): number {
    return Math.floor((usdAmount / USD_PER_MB) * BYTES_PER_MB);
  }

  // Calculate USD from bytes
  calculateUsdFromBytes(bytes: number): number {
    return (bytes / BYTES_PER_MB) * USD_PER_MB;
  }

  // Create traffic request record (before execution)
  async createTrafficRequest(
    escrowId: string,
    metadata: TrafficBuyMetadata
  ): Promise<CantonTrafficRequest> {
    const trackingId = `traffic-${uuidv4()}`;

    const result = await pool.query(
      `INSERT INTO canton_traffic_requests (
        escrow_id, receiving_validator_party_id, domain_id,
        traffic_amount_bytes, tracking_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        escrowId,
        metadata.validatorPartyId,
        metadata.domainId,
        metadata.trafficAmountBytes,
        trackingId,
      ]
    );

    return this.mapRowToTrafficRequest(result.rows[0]);
  }

  // Execute traffic purchase via Canton API
  async executeTrafficPurchase(trafficRequestId: string): Promise<CantonTrafficRequest> {
    return withTransaction(async (client) => {
      // Get traffic request
      const requestResult = await client.query(
        `SELECT * FROM canton_traffic_requests WHERE id = $1 FOR UPDATE`,
        [trafficRequestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error('Traffic request not found');
      }

      const trafficRequest = requestResult.rows[0];

      if (trafficRequest.executed_at) {
        throw new Error('Traffic request already executed');
      }

      // Call Canton Wallet API via proxied HTTP (for IP whitelisting)
      const apiUrl = `${CANTON_WALLET_API_URL}/api/validator/v0/wallet/buy-traffic-requests`;

      // Log tunnel status
      console.log(`[Canton Traffic] Executing API call, tunnel connected: ${isTunnelConnected()}`);

      try {
        const response = await proxiedPost(
          apiUrl,
          {
            receiving_validator_party_id: trafficRequest.receiving_validator_party_id,
            domain_id: trafficRequest.domain_id,
            traffic_amount: trafficRequest.traffic_amount_bytes,
            tracking_id: trafficRequest.tracking_id,
          },
          {
            'Authorization': `Bearer ${process.env.CANTON_API_TOKEN}`,
          }
        );

        console.log(`[Canton Traffic] Response status: ${response.status}, proxied: ${response.proxied}`);

        // Update traffic request with response
        const updateResult = await client.query(
          `UPDATE canton_traffic_requests
           SET canton_response = $1, executed_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [JSON.stringify(response.data), trafficRequestId]
        );

        if (response.status >= 400) {
          throw new Error(`Canton API error: ${JSON.stringify(response.data)}`);
        }

        return this.mapRowToTrafficRequest(updateResult.rows[0]);
      } catch (error) {
        // Store error in canton_response
        await client.query(
          `UPDATE canton_traffic_requests
           SET canton_response = $1
           WHERE id = $2`,
          [
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            trafficRequestId,
          ]
        );
        throw error;
      }
    });
  }

  /**
   * Execute traffic purchase with user-provided credentials
   * Bearer token is passed at execution time and NEVER stored
   * All calls go through SSH/SOCKS5 tunnel for IP whitelisting
   */
  async executeTrafficPurchaseWithCredentials(
    params: TrafficPurchaseParams
  ): Promise<TrafficPurchaseResponse> {
    const {
      escrowId,
      walletValidatorUrl,
      domainId,
      receivingValidatorPartyId,
      trafficAmountBytes,
      bearerToken, // Passed at execution time, never stored
      iapCookie,   // Optional - for MPCH validators, never stored
    } = params;

    // Generate tracking ID
    const trackingId = `traffic-${uuidv4()}`;

    // Check tunnel status
    const tunnelStatus = getTunnelStatus();
    console.log(`[Canton Traffic] Executing with user credentials, tunnel: ${JSON.stringify(tunnelStatus)}`);

    // Build API URL
    const apiUrl = `${walletValidatorUrl}/api/validator/v0/wallet/buy-traffic-requests`;

    // Generate expires_at (24 hours from now in microseconds)
    const expiresAt = (Date.now() + 24 * 60 * 60 * 1000) * 1000;

    // Prepare request payload (never includes bearer token or cookie in logs)
    const requestPayload = {
      receiving_validator_party_id: receivingValidatorPartyId,
      domain_id: domainId,
      traffic_amount: trafficAmountBytes,
      tracking_id: trackingId,
      expires_at: expiresAt,
    };

    // Build headers - always include Authorization, optionally include Cookie
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${bearerToken}`, // Never logged
    };
    if (iapCookie) {
      headers['Cookie'] = iapCookie; // Never logged
    }

    try {
      // Make proxied API call
      const response = await proxiedPost(
        apiUrl,
        requestPayload,
        headers,
        { requireProxy: true } // Always require tunnel
      );

      console.log(`[Canton Traffic] Response status: ${response.status}, proxied: ${response.proxied}`);

      // Log the request/response to canton_traffic_requests table
      // Note: We log requestPayload (no bearer token) and full response
      await pool.query(
        `INSERT INTO canton_traffic_requests (
          escrow_id, receiving_validator_party_id, domain_id,
          traffic_amount_bytes, tracking_id, canton_response, executed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (tracking_id) DO UPDATE SET
          canton_response = $6, executed_at = NOW()`,
        [
          escrowId,
          receivingValidatorPartyId,
          domainId,
          trafficAmountBytes,
          trackingId,
          JSON.stringify({
            status: response.status,
            data: response.data,
            proxied: response.proxied,
            requestPayload, // Log what was sent (no bearer token)
          }),
        ]
      );

      // Check for error response
      if (response.status >= 400) {
        return {
          success: false,
          trackingId,
          response: response.data,
          error: `Canton API returned status ${response.status}`,
        };
      }

      return {
        success: true,
        trackingId,
        response: response.data, // Full response with evidence IDs
      };
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check if this is a proxied HTTP error with more details
        const proxiedError = error as any;
        if (proxiedError.originalError) {
          errorMessage = `${error.message}. Original: ${proxiedError.originalError.message}`;
        }
        if (proxiedError.url) {
          errorMessage = `${errorMessage}. URL: ${proxiedError.url}`;
        }
      }
      console.error(`[Canton Traffic] Execution failed:`, errorMessage);

      // Log error to database
      await pool.query(
        `INSERT INTO canton_traffic_requests (
          escrow_id, receiving_validator_party_id, domain_id,
          traffic_amount_bytes, tracking_id, canton_response
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tracking_id) DO UPDATE SET
          canton_response = $6`,
        [
          escrowId,
          receivingValidatorPartyId,
          domainId,
          trafficAmountBytes,
          trackingId,
          JSON.stringify({
            error: errorMessage,
            requestPayload, // Log what was sent (no bearer token)
          }),
        ]
      );

      return {
        success: false,
        trackingId,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute standalone traffic purchase (no escrow required)
   * For direct traffic purchases from the dashboard
   */
  async executeStandaloneTrafficPurchase(
    params: {
      userId: string;
      walletValidatorUrl: string;
      domainId: string;
      receivingValidatorPartyId: string;
      trafficAmountBytes: number;
      bearerToken: string;
      iapCookie?: string;
    }
  ): Promise<TrafficPurchaseResponse> {
    const {
      userId,
      walletValidatorUrl,
      domainId,
      receivingValidatorPartyId,
      trafficAmountBytes,
      bearerToken,
      iapCookie,
    } = params;

    // Generate tracking ID
    const trackingId = `traffic-standalone-${uuidv4()}`;

    // Check tunnel status
    const tunnelStatus = getTunnelStatus();
    console.log(`[Canton Traffic] Executing standalone purchase, tunnel: ${JSON.stringify(tunnelStatus)}`);

    // Build API URL
    const apiUrl = `${walletValidatorUrl}/api/validator/v0/wallet/buy-traffic-requests`;

    // Generate expires_at (24 hours from now in microseconds)
    const expiresAt = (Date.now() + 24 * 60 * 60 * 1000) * 1000;

    // Prepare request payload
    const requestPayload = {
      receiving_validator_party_id: receivingValidatorPartyId,
      domain_id: domainId,
      traffic_amount: trafficAmountBytes,
      tracking_id: trackingId,
      expires_at: expiresAt,
    };

    // Build headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${bearerToken}`,
    };
    if (iapCookie) {
      headers['Cookie'] = iapCookie;
    }

    try {
      // Make proxied API call
      const response = await proxiedPost(
        apiUrl,
        requestPayload,
        headers,
        { requireProxy: true }
      );

      console.log(`[Canton Traffic] Standalone response status: ${response.status}, proxied: ${response.proxied}`);

      // Log the request/response (no escrow_id for standalone)
      await pool.query(
        `INSERT INTO canton_traffic_requests (
          escrow_id, receiving_validator_party_id, domain_id,
          traffic_amount_bytes, tracking_id, canton_response, executed_at
        )
        VALUES (NULL, $1, $2, $3, $4, $5, NOW())
        ON CONFLICT (tracking_id) DO UPDATE SET
          canton_response = $5, executed_at = NOW()`,
        [
          receivingValidatorPartyId,
          domainId,
          trafficAmountBytes,
          trackingId,
          JSON.stringify({
            status: response.status,
            data: response.data,
            proxied: response.proxied,
            requestPayload,
            userId, // Track who executed
            standalone: true,
          }),
        ]
      );

      // Check for error response
      if (response.status >= 400) {
        return {
          success: false,
          trackingId,
          response: response.data,
          error: `Canton API returned status ${response.status}`,
        };
      }

      return {
        success: true,
        trackingId,
        response: response.data,
      };
    } catch (error) {
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        const proxiedError = error as any;
        if (proxiedError.originalError) {
          errorMessage = `${error.message}. Original: ${proxiedError.originalError.message}`;
        }
        if (proxiedError.url) {
          errorMessage = `${errorMessage}. URL: ${proxiedError.url}`;
        }
      }
      console.error(`[Canton Traffic] Standalone execution failed:`, errorMessage);

      // Log error to database
      await pool.query(
        `INSERT INTO canton_traffic_requests (
          escrow_id, receiving_validator_party_id, domain_id,
          traffic_amount_bytes, tracking_id, canton_response
        )
        VALUES (NULL, $1, $2, $3, $4, $5)
        ON CONFLICT (tracking_id) DO UPDATE SET
          canton_response = $5`,
        [
          receivingValidatorPartyId,
          domainId,
          trafficAmountBytes,
          trackingId,
          JSON.stringify({
            error: errorMessage,
            requestPayload,
            userId,
            standalone: true,
          }),
        ]
      );

      return {
        success: false,
        trackingId,
        error: errorMessage,
      };
    }
  }

  /**
   * Check traffic purchase status via Canton API
   */
  async checkTrafficPurchaseStatus(
    params: {
      walletValidatorUrl: string;
      trackingId: string;
      bearerToken: string;
      iapCookie?: string;
    }
  ): Promise<{ status: string; data: any }> {
    const { walletValidatorUrl, trackingId, bearerToken, iapCookie } = params;

    const statusUrl = `${walletValidatorUrl}/api/validator/v0/wallet/buy-traffic-requests/${trackingId}/status`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${bearerToken}`,
    };
    if (iapCookie) {
      headers['Cookie'] = iapCookie;
    }

    const response = await proxiedPost(
      statusUrl,
      {},
      headers,
      { requireProxy: true }
    );

    return {
      status: response.data?.status || 'unknown',
      data: response.data,
    };
  }

  // Get traffic request by ID
  async getTrafficRequestById(requestId: string): Promise<CantonTrafficRequest | null> {
    const result = await pool.query(
      `SELECT * FROM canton_traffic_requests WHERE id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTrafficRequest(result.rows[0]);
  }

  // Get traffic request by escrow ID
  async getTrafficRequestByEscrowId(escrowId: string): Promise<CantonTrafficRequest | null> {
    const result = await pool.query(
      `SELECT * FROM canton_traffic_requests WHERE escrow_id = $1`,
      [escrowId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTrafficRequest(result.rows[0]);
  }

  // Get traffic request by tracking ID
  async getTrafficRequestByTrackingId(trackingId: string): Promise<CantonTrafficRequest | null> {
    const result = await pool.query(
      `SELECT * FROM canton_traffic_requests WHERE tracking_id = $1`,
      [trackingId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTrafficRequest(result.rows[0]);
  }

  // Validate traffic purchase metadata
  // domainId is optional - defaults to 'global::default' if not provided
  validateMetadata(metadata: any): metadata is TrafficBuyMetadata {
    if (typeof metadata !== 'object') return false;
    if (typeof metadata.validatorPartyId !== 'string' || metadata.validatorPartyId.length === 0) return false;
    if (typeof metadata.trafficAmountBytes !== 'number' || metadata.trafficAmountBytes <= 0) return false;

    // domainId is optional - set default if not provided
    if (!metadata.domainId || typeof metadata.domainId !== 'string') {
      metadata.domainId = 'global::default';
    }

    return true;
  }

  // Helper: Map DB row to CantonTrafficRequest
  private mapRowToTrafficRequest(row: any): CantonTrafficRequest {
    return {
      id: row.id,
      escrowId: row.escrow_id,
      receivingValidatorPartyId: row.receiving_validator_party_id,
      domainId: row.domain_id,
      trafficAmountBytes: parseInt(row.traffic_amount_bytes),
      trackingId: row.tracking_id,
      cantonResponse: row.canton_response,
      executedAt: row.executed_at,
      createdAt: row.created_at,
    };
  }
}

export const cantonTrafficService = new CantonTrafficService();
