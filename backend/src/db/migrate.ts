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
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    platform_fee DECIMAL(20, 8),
    metadata JSONB,
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

-- Stripe Payments
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
    '$2b$10$rQZ5Wm.xJY3JXqZ8ZQKQV.QYZ5Wm.xJY3JXqZ8ZQKQVuNvKxK6Wy', -- admin123
    'Platform Admin',
    'platform_admin',
    true
)
ON CONFLICT (id) DO UPDATE SET
    role = 'platform_admin',
    username = 'admin',
    display_name = 'Platform Admin';
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
