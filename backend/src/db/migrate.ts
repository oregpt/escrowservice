import { pool } from './connection.js';

const MIGRATION_SQL = `
-- ============================================
-- ESCROW SERVICE DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    billing_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'user',
    is_authenticated BOOLEAN DEFAULT false,
    is_provider BOOLEAN DEFAULT false,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Organization Members (many-to-many: users ↔ organizations)
CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    can_use_org_account BOOLEAN DEFAULT true,
    can_create_escrows BOOLEAN DEFAULT true,
    can_manage_members BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Accounts (can belong to user OR organization)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    available_balance DECIMAL(20, 8) DEFAULT 0,
    in_contract_balance DECIMAL(20, 8) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT account_owner_check CHECK (
        (user_id IS NOT NULL AND organization_id IS NULL) OR
        (user_id IS NULL AND organization_id IS NOT NULL)
    ),
    UNIQUE(user_id, currency),
    UNIQUE(organization_id, currency)
);

-- Ledger Entries (immutable audit trail)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id),
    amount DECIMAL(20, 8) NOT NULL,
    bucket VARCHAR(20) NOT NULL,
    entry_type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Service Types Registry
CREATE TABLE IF NOT EXISTS service_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    party_a_delivers JSONB NOT NULL,
    party_b_delivers JSONB NOT NULL,
    platform_fee_percent DECIMAL(5, 2) DEFAULT 15.00,
    auto_acceptable BOOLEAN DEFAULT true,
    requires_party_a_confirmation BOOLEAN DEFAULT true,
    requires_party_b_confirmation BOOLEAN DEFAULT true,
    metadata_schema JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Escrows
CREATE TABLE IF NOT EXISTS escrows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type_id VARCHAR(50) REFERENCES service_types(id),
    party_a_user_id UUID REFERENCES users(id),
    party_b_user_id UUID REFERENCES users(id),
    -- Counterparty details (for invites before they accept)
    is_open BOOLEAN DEFAULT false,
    counterparty_name VARCHAR(255),
    counterparty_email VARCHAR(255),
    -- Privacy level: 'public' (anyone), 'platform' (authenticated users), 'private' (parties only)
    privacy_level VARCHAR(20) DEFAULT 'platform',
    -- Status and amounts
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    platform_fee DECIMAL(20, 8),
    -- Terms and description
    title VARCHAR(255),
    description TEXT,
    terms TEXT,
    -- Service-specific data stored as JSON
    metadata JSONB,
    -- Timestamps
    party_a_confirmed_at TIMESTAMP,
    party_b_confirmed_at TIMESTAMP,
    funded_at TIMESTAMP,
    completed_at TIMESTAMP,
    canceled_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Escrow Events (audit trail)
CREATE TABLE IF NOT EXISTS escrow_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id),
    event_type VARCHAR(50) NOT NULL,
    actor_user_id UUID REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Provider Settings
CREATE TABLE IF NOT EXISTS provider_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    service_type_id VARCHAR(50) REFERENCES service_types(id),
    auto_accept_enabled BOOLEAN DEFAULT false,
    max_amount DECIMAL(20, 8),
    min_amount DECIMAL(20, 8),
    capabilities JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, service_type_id)
);

-- Stripe Payments (Legacy - kept for backwards compatibility)
CREATE TABLE IF NOT EXISTS stripe_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_checkout_session_id VARCHAR(255),
    user_id UUID REFERENCES users(id),
    escrow_id UUID REFERENCES escrows(id),
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Payments (Provider-agnostic - supports Stripe, crypto, bank, etc.)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    escrow_id UUID REFERENCES escrows(id),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    provider VARCHAR(30) NOT NULL,
    external_id VARCHAR(255),
    provider_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Canton Traffic Requests (service-specific)
CREATE TABLE IF NOT EXISTS canton_traffic_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id),
    receiving_validator_party_id TEXT NOT NULL,
    domain_id TEXT NOT NULL,
    traffic_amount_bytes BIGINT NOT NULL,
    tracking_id VARCHAR(255) UNIQUE,
    canton_response JSONB,
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Attachments (documents, files, API keys held in escrow)
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES users(id),
    attachment_type VARCHAR(20) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    storage_path TEXT,
    storage_provider VARCHAR(20) DEFAULT 'local',
    checksum_sha256 VARCHAR(64),
    encryption_key_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
    released_to_user_id UUID REFERENCES users(id),
    released_at TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Attachment Access Log (audit trail for downloads)
CREATE TABLE IF NOT EXISTS attachment_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attachment_id UUID REFERENCES attachments(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Escrow Messages (notes/communication between parties)
CREATE TABLE IF NOT EXISTS escrow_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    is_system_message BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Platform Settings (key-value store for platform configuration)
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tokenization Records (on-chain contract history for escrows)
-- Each status update creates a new record as the prior contractId becomes invalid
CREATE TABLE IF NOT EXISTS tokenization_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
    -- On-chain identifiers (from blockchain API response)
    contract_id TEXT NOT NULL,
    update_id TEXT,
    "offset" BIGINT,
    -- Tokenization platform identifiers
    token_id TEXT,
    tokenization_platform VARCHAR(100),
    -- Additional metadata
    metadata JSONB,
    -- Status at time of tokenization
    escrow_status VARCHAR(50),
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Escrow Templates (user-saved and platform templates)
CREATE TABLE IF NOT EXISTS escrow_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    service_type_id VARCHAR(50) REFERENCES service_types(id),
    is_platform_template BOOLEAN DEFAULT false,
    -- Template configuration (stores all escrow creation fields)
    config JSONB NOT NULL DEFAULT '{}',
    -- Usage tracking
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_escrow_templates_user ON escrow_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_templates_platform ON escrow_templates(is_platform_template) WHERE is_platform_template = true;
CREATE INDEX IF NOT EXISTS idx_escrow_templates_service_type ON escrow_templates(service_type_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_id ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_escrows_party_a ON escrows(party_a_user_id);
CREATE INDEX IF NOT EXISTS idx_escrows_party_b ON escrows(party_b_user_id);
CREATE INDEX IF NOT EXISTS idx_escrows_status ON escrows(status);
CREATE INDEX IF NOT EXISTS idx_escrow_events_escrow_id ON escrow_events(escrow_id);
CREATE INDEX IF NOT EXISTS idx_attachments_escrow ON attachments(escrow_id);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON attachments(status);
CREATE INDEX IF NOT EXISTS idx_attachment_access_log_attachment ON attachment_access_log(attachment_id);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_escrow_messages_escrow ON escrow_messages(escrow_id);
CREATE INDEX IF NOT EXISTS idx_tokenization_records_escrow ON tokenization_records(escrow_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id) WHERE external_id IS NOT NULL;
`;

// Migration for existing databases - add new columns if they don't exist
const MIGRATION_ADD_COLUMNS = `
-- Add new columns to users table if they don't exist
DO $$
BEGIN
    -- Add username column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(100);
    END IF;

    -- Add password_hash column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    END IF;

    -- Add role column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
    END IF;
END $$;

-- Create unique index on username if column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_username') THEN
        CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_role') THEN
        CREATE INDEX idx_users_role ON users(role);
    END IF;
END $$;

-- Add new columns to escrows table if they don't exist
DO $$
BEGIN
    -- Add is_open column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'is_open') THEN
        ALTER TABLE escrows ADD COLUMN is_open BOOLEAN DEFAULT false;
    END IF;

    -- Add counterparty_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'counterparty_name') THEN
        ALTER TABLE escrows ADD COLUMN counterparty_name VARCHAR(255);
    END IF;

    -- Add counterparty_email column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'counterparty_email') THEN
        ALTER TABLE escrows ADD COLUMN counterparty_email VARCHAR(255);
    END IF;

    -- Add title column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'title') THEN
        ALTER TABLE escrows ADD COLUMN title VARCHAR(255);
    END IF;

    -- Add description column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'description') THEN
        ALTER TABLE escrows ADD COLUMN description TEXT;
    END IF;

    -- Add terms column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'terms') THEN
        ALTER TABLE escrows ADD COLUMN terms TEXT;
    END IF;

    -- Add privacy_level column (public, platform, private)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'privacy_level') THEN
        ALTER TABLE escrows ADD COLUMN privacy_level VARCHAR(20) DEFAULT 'platform';
    END IF;
END $$;

-- Create index on is_open for finding open escrows
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_escrows_is_open') THEN
        CREATE INDEX idx_escrows_is_open ON escrows(is_open) WHERE is_open = true;
    END IF;
END $$;

-- Add primary_org_id to users (every user must belong to an org)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'primary_org_id') THEN
        ALTER TABLE users ADD COLUMN primary_org_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Add org-based columns to escrows table
DO $$
BEGIN
    -- Party A org (the organization creating the escrow) - required
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'party_a_org_id') THEN
        ALTER TABLE escrows ADD COLUMN party_a_org_id UUID REFERENCES organizations(id);
    END IF;

    -- Created by user (who created it - for audit trail)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'created_by_user_id') THEN
        ALTER TABLE escrows ADD COLUMN created_by_user_id UUID REFERENCES users(id);
    END IF;

    -- Party B org (if counterparty is an organization)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'party_b_org_id') THEN
        ALTER TABLE escrows ADD COLUMN party_b_org_id UUID REFERENCES organizations(id);
    END IF;

    -- Accepted by user (who accepted - for audit trail)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'accepted_by_user_id') THEN
        ALTER TABLE escrows ADD COLUMN accepted_by_user_id UUID REFERENCES users(id);
    END IF;
END $$;

-- Migrate existing escrows: copy party_a_user_id to created_by_user_id
DO $$
BEGIN
    UPDATE escrows
    SET created_by_user_id = party_a_user_id
    WHERE created_by_user_id IS NULL AND party_a_user_id IS NOT NULL;
END $$;

-- Create indexes for org-based queries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_escrows_party_a_org') THEN
        CREATE INDEX idx_escrows_party_a_org ON escrows(party_a_org_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_escrows_party_b_org') THEN
        CREATE INDEX idx_escrows_party_b_org ON escrows(party_b_org_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_escrows_created_by') THEN
        CREATE INDEX idx_escrows_created_by ON escrows(created_by_user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_primary_org') THEN
        CREATE INDEX idx_users_primary_org ON users(primary_org_id);
    END IF;
END $$;

-- Add arbiter columns to escrows table
-- Arbiter is the third party who can resolve disputes (cancel or force-complete)
-- Platform admin always retains override ability regardless of custom arbiter
DO $$
BEGIN
    -- Arbiter type: 'platform_only' (default), 'organization', 'person'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'arbiter_type') THEN
        ALTER TABLE escrows ADD COLUMN arbiter_type VARCHAR(20) DEFAULT 'platform_only';
    END IF;

    -- Arbiter organization (if arbiter_type = 'organization')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'arbiter_org_id') THEN
        ALTER TABLE escrows ADD COLUMN arbiter_org_id UUID REFERENCES organizations(id);
    END IF;

    -- Arbiter user (if arbiter_type = 'person' and they've registered)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'arbiter_user_id') THEN
        ALTER TABLE escrows ADD COLUMN arbiter_user_id UUID REFERENCES users(id);
    END IF;

    -- Arbiter email (for inviting someone before they register)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escrows' AND column_name = 'arbiter_email') THEN
        ALTER TABLE escrows ADD COLUMN arbiter_email VARCHAR(255);
    END IF;
END $$;

-- Create indexes for arbiter queries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_escrows_arbiter_org') THEN
        CREATE INDEX idx_escrows_arbiter_org ON escrows(arbiter_org_id) WHERE arbiter_org_id IS NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_escrows_arbiter_user') THEN
        CREATE INDEX idx_escrows_arbiter_user ON escrows(arbiter_user_id) WHERE arbiter_user_id IS NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_escrows_arbiter_email') THEN
        CREATE INDEX idx_escrows_arbiter_email ON escrows(arbiter_email) WHERE arbiter_email IS NOT NULL;
    END IF;
END $$;

-- Add purpose column to attachments for evidence categorization
-- Purpose indicates what this attachment is proving or delivering
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attachments' AND column_name = 'purpose') THEN
        ALTER TABLE attachments ADD COLUMN purpose VARCHAR(30);
    END IF;
END $$;

-- Create index for querying attachments by purpose
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attachments_purpose') THEN
        CREATE INDEX idx_attachments_purpose ON attachments(purpose) WHERE purpose IS NOT NULL;
    END IF;
END $$;
`;

const SEED_SERVICE_TYPES = `
INSERT INTO service_types (id, name, description, party_a_delivers, party_b_delivers, platform_fee_percent, metadata_schema)
VALUES
(
    'TRAFFIC_BUY',
    'Canton Traffic Purchase',
    'Buy Canton Network traffic for a validator that has run out of bandwidth',
    '{"type": "FIAT_USD", "label": "Payment"}',
    '{"type": "CANTON_TRAFFIC", "label": "Traffic (bytes)"}',
    15.00,
    '{"validatorPartyId": "string", "trafficAmountBytes": "integer", "domainId": "string"}'
),
(
    'API_KEY_EXCHANGE',
    'API Key Exchange',
    'Exchange payment for API key access',
    '{"type": "FIAT_USD", "label": "Payment"}',
    '{"type": "API_KEY", "label": "API Key"}',
    10.00,
    '{"apiName": "string", "durationDays": "integer"}'
),
(
    'DOCUMENT_DELIVERY',
    'Document Delivery',
    'Pay for secure document delivery',
    '{"type": "FIAT_USD", "label": "Payment"}',
    '{"type": "DOCUMENT", "label": "Document"}',
    10.00,
    '{"documentDescription": "string"}'
),
(
    'CUSTOM',
    'Custom Escrow',
    'User-defined escrow terms',
    '{"type": "ANY", "label": "Item A"}',
    '{"type": "ANY", "label": "Item B"}',
    15.00,
    '{}'
)
ON CONFLICT (id) DO NOTHING;
`;

// Seed platform admin - password is 'admin123' (bcrypt hash)
// In production, change this password immediately!
const SEED_PLATFORM_ADMIN = `
INSERT INTO users (id, username, email, password_hash, display_name, role, is_authenticated)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin',
    'admin@escrowservice.local',
    '$2b$10$MCtDhB1SN8SbdXy5yF7plO2xb5eQm4O6.KFASw3e9jM9AWn0aSVQ6', -- admin123
    'Platform Admin',
    'platform_admin',
    true
)
ON CONFLICT (id) DO UPDATE SET
    role = 'platform_admin',
    username = 'admin',
    display_name = 'Platform Admin',
    password_hash = '$2b$10$MCtDhB1SN8SbdXy5yF7plO2xb5eQm4O6.KFASw3e9jM9AWn0aSVQ6';
`;

async function migrate() {
  console.log('Running database migrations...');

  try {
    // Run schema migration
    await pool.query(MIGRATION_SQL);
    console.log('Schema migration completed');

    // Run column additions for existing databases
    await pool.query(MIGRATION_ADD_COLUMNS);
    console.log('Column migrations completed');

    // Seed service types
    await pool.query(SEED_SERVICE_TYPES);
    console.log('Service types seeded');

    // Seed platform admin
    await pool.query(SEED_PLATFORM_ADMIN);
    console.log('Platform admin seeded (username: admin)');

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);
