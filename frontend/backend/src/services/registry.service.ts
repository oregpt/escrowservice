/**
 * Registry Service - theRegistry API Integration
 *
 * Handles tokenization of escrows on the Canton blockchain via theRegistry platform.
 * Supports:
 * - Per-org API key configuration
 * - Asset registration (tokenization)
 * - Metadata updates (creates new contract, archives old)
 * - Status tracking
 */

import { pool } from '../db/connection.js';
import crypto from 'crypto';
import { platformSettingsService } from './platform-settings.service.js';
import type {
  OrgRegistryConfig,
  TokenizationRecordExtended,
  RegistryAssetRegistrationRequest,
  RegistryAssetRegistrationResponse,
  RegistryMetadataUpdateResponse,
  TokenizationResponse,
  Escrow,
  ServiceTypeId,
} from '../types/index.js';

// Encryption key for API keys (should come from env in production)
const ENCRYPTION_KEY = process.env.REGISTRY_ENCRYPTION_KEY || 'default-key-change-in-production-32';

// Service Type to Asset Type mapping
const SERVICE_TYPE_TO_ASSET_TYPE: Record<ServiceTypeId, string> = {
  TRAFFIC_BUY: 'TrafficPurchase',
  DOCUMENT_DELIVERY: 'DocumentDelivery',
  API_KEY_EXCHANGE: 'ApiKeyExchange',
  CUSTOM: 'Custom',
};

/**
 * Encrypt API key for storage
 */
function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt API key from storage
 */
function decryptApiKey(encryptedData: string): string {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Get org registry configuration
 */
export async function getOrgRegistryConfig(organizationId: string): Promise<OrgRegistryConfig | null> {
  const result = await pool.query(
    `SELECT id, organization_id, api_key_encrypted, api_url, environment, wallet_address, is_configured, created_at, updated_at
     FROM org_registry_config
     WHERE organization_id = $1`,
    [organizationId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    organizationId: row.organization_id,
    apiKeyEncrypted: row.api_key_encrypted,
    apiUrl: row.api_url,
    environment: row.environment,
    walletAddress: row.wallet_address,
    isConfigured: row.is_configured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upsert org registry configuration
 */
export async function upsertOrgRegistryConfig(
  organizationId: string,
  config: {
    apiKey?: string;
    environment?: 'TESTNET' | 'MAINNET';
    walletAddress?: string;
  }
): Promise<OrgRegistryConfig> {
  const encryptedApiKey = config.apiKey ? encryptApiKey(config.apiKey) : undefined;

  const result = await pool.query(
    `INSERT INTO org_registry_config (organization_id, api_key_encrypted, environment, wallet_address, is_configured, updated_at)
     VALUES ($1, $2, COALESCE($3, 'TESTNET'), $4, $5, NOW())
     ON CONFLICT (organization_id) DO UPDATE SET
       api_key_encrypted = COALESCE($2, org_registry_config.api_key_encrypted),
       environment = COALESCE($3, org_registry_config.environment),
       wallet_address = COALESCE($4, org_registry_config.wallet_address),
       is_configured = $5,
       updated_at = NOW()
     RETURNING id, organization_id, api_key_encrypted, environment, wallet_address, is_configured, created_at, updated_at`,
    [
      organizationId,
      encryptedApiKey,
      config.environment,
      config.walletAddress,
      !!(encryptedApiKey || config.walletAddress),
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    organizationId: row.organization_id,
    apiKeyEncrypted: row.api_key_encrypted,
    environment: row.environment,
    walletAddress: row.wallet_address,
    isConfigured: row.is_configured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get the decrypted API key for an org
 */
export async function getDecryptedApiKey(organizationId: string): Promise<string | null> {
  const config = await getOrgRegistryConfig(organizationId);
  if (!config || !config.apiKeyEncrypted) {
    return null;
  }
  return decryptApiKey(config.apiKeyEncrypted);
}

/**
 * Build escrow metadata for theRegistry
 * This includes ALL escrow data that should be stored on-chain
 */
function buildEscrowMetadata(escrow: Escrow): Record<string, any> {
  return {
    // Core escrow identifiers
    escrowId: escrow.id,
    serviceTypeId: escrow.serviceTypeId,

    // Parties (IDs only, not personal info)
    partyAOrgId: escrow.partyAOrgId,
    partyBOrgId: escrow.partyBOrgId,
    partyAUserId: escrow.partyAUserId,
    partyBUserId: escrow.partyBUserId,
    createdByUserId: escrow.createdByUserId,
    acceptedByUserId: escrow.acceptedByUserId,

    // Financial
    amount: escrow.amount,
    currency: escrow.currency,
    platformFee: escrow.platformFee,

    // Status
    status: escrow.status,
    isOpen: escrow.isOpen,
    privacyLevel: escrow.privacyLevel,

    // Terms (public info)
    title: escrow.title,
    description: escrow.description,
    terms: escrow.terms,

    // Service-specific data
    serviceMetadata: escrow.metadata,

    // Timestamps
    createdAt: escrow.createdAt?.toISOString(),
    updatedAt: escrow.updatedAt?.toISOString(),
    fundedAt: escrow.fundedAt?.toISOString(),
    completedAt: escrow.completedAt?.toISOString(),
    canceledAt: escrow.canceledAt?.toISOString(),
    expiresAt: escrow.expiresAt?.toISOString(),
    partyAConfirmedAt: escrow.partyAConfirmedAt?.toISOString(),
    partyBConfirmedAt: escrow.partyBConfirmedAt?.toISOString(),

    // Arbiter
    arbiterType: escrow.arbiterType,
    arbiterOrgId: escrow.arbiterOrgId,
    arbiterUserId: escrow.arbiterUserId,

    // Tokenization timestamp
    tokenizedAt: new Date().toISOString(),
  };
}

/**
 * Get escrow by ID (internal helper)
 */
async function getEscrowById(escrowId: string): Promise<Escrow | null> {
  const result = await pool.query(
    `SELECT * FROM escrows WHERE id = $1`,
    [escrowId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    serviceTypeId: row.service_type_id,
    partyAOrgId: row.party_a_org_id,
    createdByUserId: row.created_by_user_id,
    partyBOrgId: row.party_b_org_id,
    partyBUserId: row.party_b_user_id,
    acceptedByUserId: row.accepted_by_user_id,
    partyAUserId: row.party_a_user_id,
    isOpen: row.is_open,
    counterpartyName: row.counterparty_name,
    counterpartyEmail: row.counterparty_email,
    privacyLevel: row.privacy_level,
    arbiterType: row.arbiter_type,
    arbiterOrgId: row.arbiter_org_id,
    arbiterUserId: row.arbiter_user_id,
    arbiterEmail: row.arbiter_email,
    status: row.status,
    amount: parseFloat(row.amount),
    currency: row.currency,
    platformFee: parseFloat(row.platform_fee || '0'),
    title: row.title,
    description: row.description,
    terms: row.terms,
    metadata: row.metadata,
    partyAConfirmedAt: row.party_a_confirmed_at,
    partyBConfirmedAt: row.party_b_confirmed_at,
    fundedAt: row.funded_at,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get the latest tokenization record for an escrow
 */
export async function getTokenizationRecord(escrowId: string): Promise<TokenizationRecordExtended | null> {
  const result = await pool.query(
    `SELECT id, escrow_id, contract_id, update_id, "offset",
            asset_registration_id, previous_contract_id, sync_status, environment,
            token_id, tokenization_platform, metadata, escrow_status, created_at, updated_at
     FROM tokenization_records
     WHERE escrow_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [escrowId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    escrowId: row.escrow_id,
    contractId: row.contract_id,
    updateId: row.update_id,
    offset: row.offset,
    assetRegistrationId: row.asset_registration_id,
    previousContractId: row.previous_contract_id,
    syncStatus: row.sync_status,
    environment: row.environment,
    tokenId: row.token_id,
    tokenizationPlatform: row.tokenization_platform,
    metadata: row.metadata,
    escrowStatus: row.escrow_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all tokenization records for an escrow (history)
 */
export async function getTokenizationHistory(escrowId: string): Promise<TokenizationRecordExtended[]> {
  const result = await pool.query(
    `SELECT id, escrow_id, contract_id, update_id, "offset",
            asset_registration_id, previous_contract_id, sync_status, environment,
            token_id, tokenization_platform, metadata, escrow_status, created_at, updated_at
     FROM tokenization_records
     WHERE escrow_id = $1
     ORDER BY created_at DESC`,
    [escrowId]
  );

  return result.rows.map(row => ({
    id: row.id,
    escrowId: row.escrow_id,
    contractId: row.contract_id,
    updateId: row.update_id,
    offset: row.offset,
    assetRegistrationId: row.asset_registration_id,
    previousContractId: row.previous_contract_id,
    syncStatus: row.sync_status,
    environment: row.environment,
    tokenId: row.token_id,
    tokenizationPlatform: row.tokenization_platform,
    metadata: row.metadata,
    escrowStatus: row.escrow_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Tokenize an escrow (first-time registration with theRegistry)
 */
export async function tokenizeEscrow(
  escrowId: string,
  organizationId: string,
  options?: {
    customName?: string;
    customDescription?: string;
  }
): Promise<TokenizationResponse> {
  // Get org config
  const config = await getOrgRegistryConfig(organizationId);
  if (!config || !config.apiKeyEncrypted) {
    return {
      success: false,
      error: 'Organization does not have theRegistry API key configured',
    };
  }

  // Get escrow
  const escrow = await getEscrowById(escrowId);
  if (!escrow) {
    return {
      success: false,
      error: 'Escrow not found',
    };
  }

  // Check if already tokenized
  const existingRecord = await getTokenizationRecord(escrowId);
  if (existingRecord && existingRecord.syncStatus === 'synced') {
    return {
      success: false,
      error: 'Escrow is already tokenized. Use update endpoint to modify metadata.',
    };
  }

  // Build the registration request matching theRegistry API spec
  const metadata = buildEscrowMetadata(escrow);

  // Validate required wallet_address
  if (!config.walletAddress) {
    return {
      success: false,
      error: 'Wallet address is required for tokenization. Please configure it in the organization feature flags.',
    };
  }

  const registrationRequest = {
    asset_type_id: 1, // Default asset type ID - can be configured later
    wallet_address: config.walletAddress,
    network: config.environment === 'MAINNET' ? 'mainnet' : 'testnet',
    fields: [
      { key: 'name', value: options?.customName || escrow.title || `Escrow ${escrow.id.slice(0, 8)}` },
      { key: 'description', value: options?.customDescription || escrow.description || `${escrow.serviceTypeId} escrow contract` },
    ],
    attributes: [
      { key: 'service_type', value: escrow.serviceTypeId },
      { key: 'amount', value: String(escrow.amount) },
      { key: 'currency', value: escrow.currency },
      { key: 'status', value: escrow.status },
      { key: 'created_at', value: escrow.createdAt?.toISOString() || new Date().toISOString() },
      { key: 'escrow_id', value: escrow.id },
    ],
    metadata: JSON.stringify(metadata),
  };

  // Decrypt API key
  const apiKey = decryptApiKey(config.apiKeyEncrypted);

  // Get API URL from platform settings
  const platformSettings = await platformSettingsService.getSettings();
  if (!platformSettings.registryApiUrl) {
    return {
      success: false,
      error: 'theRegistry API URL not configured in platform settings',
    };
  }
  const baseUrl = platformSettings.registryApiUrl.replace(/\/$/, ''); // Remove trailing slash

  try {
    // Call theRegistry API
    const response = await fetch(`${baseUrl}/api/public/asset-registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(registrationRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('theRegistry API error:', errorText);

      // Create failed record
      await pool.query(
        `INSERT INTO tokenization_records
         (escrow_id, sync_status, environment, tokenization_platform, metadata, escrow_status, updated_at)
         VALUES ($1, 'failed', $2, 'theRegistry', $3, $4, NOW())`,
        [escrowId, config.environment, { error: errorText }, escrow.status]
      );

      return {
        success: false,
        error: `theRegistry API error: ${response.status} - ${errorText}`,
      };
    }

    const registryResponse: RegistryAssetRegistrationResponse = await response.json();

    // Create tokenization record
    const recordResult = await pool.query(
      `INSERT INTO tokenization_records
       (escrow_id, contract_id, update_id, "offset", asset_registration_id, sync_status, environment,
        tokenization_platform, metadata, escrow_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'synced', $6, 'theRegistry', $7, $8, NOW())
       RETURNING *`,
      [
        escrowId,
        registryResponse.contractId,
        registryResponse.updateId,
        registryResponse.completionOffset,
        registryResponse.id,
        config.environment,
        metadata,
        escrow.status,
      ]
    );

    // Update escrow is_tokenized flag
    await pool.query(
      `UPDATE escrows SET is_tokenized = true, updated_at = NOW() WHERE id = $1`,
      [escrowId]
    );

    const record = recordResult.rows[0];
    return {
      success: true,
      record: {
        id: record.id,
        escrowId: record.escrow_id,
        contractId: record.contract_id,
        updateId: record.update_id,
        offset: record.offset,
        assetRegistrationId: record.asset_registration_id,
        previousContractId: record.previous_contract_id,
        syncStatus: record.sync_status,
        environment: record.environment,
        tokenId: record.token_id,
        tokenizationPlatform: record.tokenization_platform,
        metadata: record.metadata,
        escrowStatus: record.escrow_status,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      registryResponse,
    };
  } catch (error) {
    console.error('Error calling theRegistry API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calling theRegistry API',
    };
  }
}

/**
 * Update tokenized escrow metadata (creates new contract, archives old)
 */
export async function updateTokenization(
  escrowId: string,
  organizationId: string
): Promise<TokenizationResponse> {
  // Get org config
  const config = await getOrgRegistryConfig(organizationId);
  if (!config || !config.apiKeyEncrypted) {
    return {
      success: false,
      error: 'Organization does not have theRegistry API key configured',
    };
  }

  // Get existing tokenization record
  const existingRecord = await getTokenizationRecord(escrowId);
  if (!existingRecord || existingRecord.syncStatus !== 'synced') {
    return {
      success: false,
      error: 'Escrow is not tokenized. Use tokenize endpoint first.',
    };
  }

  if (!existingRecord.assetRegistrationId) {
    return {
      success: false,
      error: 'Missing asset registration ID',
    };
  }

  // Get escrow
  const escrow = await getEscrowById(escrowId);
  if (!escrow) {
    return {
      success: false,
      error: 'Escrow not found',
    };
  }

  // Build updated metadata (MUST include ALL fields - blockchain replaces, doesn't merge)
  const metadata = buildEscrowMetadata(escrow);
  metadata.previousContractId = existingRecord.contractId;
  metadata.updateNumber = (existingRecord.metadata?.updateNumber || 0) + 1;

  // Decrypt API key
  const apiKey = decryptApiKey(config.apiKeyEncrypted);

  // Get API URL from platform settings
  const platformSettings = await platformSettingsService.getSettings();
  if (!platformSettings.registryApiUrl) {
    return {
      success: false,
      error: 'theRegistry API URL not configured in platform settings',
    };
  }
  const baseUrl = platformSettings.registryApiUrl.replace(/\/$/, ''); // Remove trailing slash

  try {
    // Call theRegistry metadata update API
    const response = await fetch(
      `${baseUrl}/api/public/asset-registrations/${existingRecord.assetRegistrationId}/metadata`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ metadata }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('theRegistry metadata update error:', errorText);
      return {
        success: false,
        error: `theRegistry API error: ${response.status} - ${errorText}`,
      };
    }

    const registryResponse: RegistryMetadataUpdateResponse = await response.json();

    // Create new tokenization record (each update creates a new record with new contract ID)
    const recordResult = await pool.query(
      `INSERT INTO tokenization_records
       (escrow_id, contract_id, update_id, "offset", asset_registration_id, previous_contract_id,
        sync_status, environment, tokenization_platform, metadata, escrow_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'synced', $7, 'theRegistry', $8, $9, NOW())
       RETURNING *`,
      [
        escrowId,
        registryResponse.contractId,
        registryResponse.updateId,
        registryResponse.completionOffset,
        registryResponse.id,
        registryResponse.previousContractId,
        config.environment,
        metadata,
        escrow.status,
      ]
    );

    const record = recordResult.rows[0];
    return {
      success: true,
      record: {
        id: record.id,
        escrowId: record.escrow_id,
        contractId: record.contract_id,
        updateId: record.update_id,
        offset: record.offset,
        assetRegistrationId: record.asset_registration_id,
        previousContractId: record.previous_contract_id,
        syncStatus: record.sync_status,
        environment: record.environment,
        tokenId: record.token_id,
        tokenizationPlatform: record.tokenization_platform,
        metadata: record.metadata,
        escrowStatus: record.escrow_status,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      registryResponse,
    };
  } catch (error) {
    console.error('Error calling theRegistry metadata update API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calling theRegistry API',
    };
  }
}

/**
 * Check if an org has tokenization feature enabled
 */
export async function isTokenizationEnabled(organizationId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT enabled FROM org_feature_flags
     WHERE organization_id = $1 AND feature_key = 'tokenization'`,
    [organizationId]
  );
  return result.rows.length > 0 && result.rows[0].enabled === true;
}

/**
 * Check if an escrow can be tokenized
 */
export async function canTokenize(escrowId: string, organizationId: string): Promise<{ canTokenize: boolean; reason?: string }> {
  // Check feature flag
  const featureEnabled = await isTokenizationEnabled(organizationId);
  if (!featureEnabled) {
    return { canTokenize: false, reason: 'Tokenization feature not enabled for organization' };
  }

  // Check org has API key configured
  const config = await getOrgRegistryConfig(organizationId);
  if (!config || !config.isConfigured) {
    return { canTokenize: false, reason: 'theRegistry API key not configured' };
  }

  // Get escrow
  const escrow = await getEscrowById(escrowId);
  if (!escrow) {
    return { canTokenize: false, reason: 'Escrow not found' };
  }

  // Check escrow status - must be PENDING_ACCEPTANCE or later
  const validStatuses = ['PENDING_ACCEPTANCE', 'PENDING_FUNDING', 'FUNDED', 'PARTY_B_CONFIRMED', 'PARTY_A_CONFIRMED', 'COMPLETED'];
  if (!validStatuses.includes(escrow.status)) {
    return { canTokenize: false, reason: `Escrow status ${escrow.status} not eligible for tokenization` };
  }

  // Check if already tokenized
  const existingRecord = await getTokenizationRecord(escrowId);
  if (existingRecord && existingRecord.syncStatus === 'synced') {
    return { canTokenize: false, reason: 'Already tokenized (use update instead)' };
  }

  return { canTokenize: true };
}

/**
 * Check if a tokenized escrow can be updated
 */
export async function canUpdateTokenization(escrowId: string, organizationId: string): Promise<{ canUpdate: boolean; reason?: string }> {
  // Check feature flag
  const featureEnabled = await isTokenizationEnabled(organizationId);
  if (!featureEnabled) {
    return { canUpdate: false, reason: 'Tokenization feature not enabled for organization' };
  }

  // Check org has API key configured
  const config = await getOrgRegistryConfig(organizationId);
  if (!config || !config.isConfigured) {
    return { canUpdate: false, reason: 'theRegistry API key not configured' };
  }

  // Check if tokenized
  const existingRecord = await getTokenizationRecord(escrowId);
  if (!existingRecord || existingRecord.syncStatus !== 'synced') {
    return { canUpdate: false, reason: 'Escrow not tokenized yet' };
  }

  return { canUpdate: true };
}
