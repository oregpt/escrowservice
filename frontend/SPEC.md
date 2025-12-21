# Escrow Service Platform - Technical Specification

**Version:** 1.0
**Date:** December 18, 2025
**Status:** Draft

---

## 1. Executive Summary

A generic two-party escrow platform that acts as a trustless middleman for any exchange between two parties. The first use case is Canton Network traffic purchases, but the platform is designed to support any service type where two parties need a trusted intermediary.

---

## 2. Core Concept

### 2.1 What We're Building

A platform where:
- **Party A (Requestor)** — needs something done
- **Party B (Provider)** — will fulfill the request
- **Platform** — holds value in escrow until both parties confirm completion

### 2.2 Key Principles

1. **Trustless** — Neither party needs to trust each other
2. **Generic** — Supports any service type (money, API keys, documents, access)
3. **Tracked** — Full audit trail of all transactions
4. **Extensible** — New service types can be added easily
5. **Multi-tenant** — Organizations contain users, cross-org interactions supported
6. **Document-first** — Attachments supported from day 1 (escrow can BE a document)

---

## 3. Multi-Tenant Organization Structure

### 3.1 Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                         PLATFORM                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐          ┌──────────────────┐             │
│  │   Organization A  │          │   Organization B  │             │
│  │   (MPC Holdings)  │          │   (Acme Corp)     │             │
│  ├──────────────────┤          ├──────────────────┤             │
│  │  • User 1 (Admin) │          │  • User 4 (Admin) │             │
│  │  • User 2         │  ←────→  │  • User 5         │             │
│  │  • User 3         │ interact │  • User 6         │             │
│  └──────────────────┘          └──────────────────┘             │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │  Individual User  │  (No org, personal account)              │
│  │  • User 7         │                                           │
│  └──────────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Organization Features

| Feature | Description |
|---------|-------------|
| **Shared Account** | Org can have a shared account for all members |
| **Member Roles** | Admin, Member, Viewer |
| **Cross-Org Escrow** | User from Org A can escrow with User from Org B |
| **Org-Level Settings** | Auto-accept rules can be set at org level |
| **Billing** | Org-level billing and invoicing |

### 3.3 User Membership

A user can be:
- **Individual** — No organization, personal account
- **Org Member** — Belongs to one or more organizations
- **Org Admin** — Can manage org settings, members, account

### 3.4 Account Ownership

| Type | Owner | Access |
|------|-------|--------|
| **Personal Account** | Individual user | User only |
| **Org Account** | Organization | All org members (based on permissions) |

---

## 4. Document Attachments

### 4.1 Why Documents from Day 1?

Sometimes the escrow **IS** the document:
- Payment for a signed contract
- Exchange of API credentials
- Delivery of confidential files
- Trade of digital assets/licenses

### 4.2 Attachment Types

| Type | Description | Example |
|------|-------------|---------|
| `DOCUMENT` | PDF, Word, etc. | Signed contract |
| `IMAGE` | PNG, JPG, etc. | Proof of delivery |
| `TEXT` | Plain text, API keys | API credentials |
| `ARCHIVE` | ZIP, encrypted files | Software package |
| `LINK` | URL to external resource | Cloud storage link |

### 4.3 Attachment Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│  UPLOAD                                                           │
│  Party uploads document → Encrypted & stored                     │
│  Status: UPLOADED (only uploader can see)                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  HELD IN ESCROW                                                   │
│  Document locked until conditions met                            │
│  Status: ESCROWED (platform holds, neither party can access)     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  RELEASED                                                         │
│  Conditions met → Document released to recipient                 │
│  Status: RELEASED (recipient can download)                       │
└──────────────────────────────────────────────────────────────────┘
```

### 4.4 Attachment on Escrow

Each escrow can have multiple attachments:

```json
{
  "escrow_id": "abc123",
  "attachments": [
    {
      "id": "att_001",
      "type": "DOCUMENT",
      "filename": "contract_signed.pdf",
      "uploaded_by": "party_a",
      "uploaded_at": "2025-12-18T10:00:00Z",
      "status": "ESCROWED",
      "released_to": null,
      "size_bytes": 245000,
      "mime_type": "application/pdf",
      "checksum_sha256": "abc123..."
    },
    {
      "id": "att_002",
      "type": "TEXT",
      "filename": "api_key.txt",
      "uploaded_by": "party_b",
      "uploaded_at": "2025-12-18T11:00:00Z",
      "status": "RELEASED",
      "released_to": "party_a",
      "size_bytes": 64
    }
  ]
}
```

### 4.5 Document Security

1. **Encryption at rest** — All files encrypted with AES-256
2. **Encryption in transit** — HTTPS only
3. **Access control** — Only authorized parties can download
4. **Checksums** — SHA-256 hash to verify integrity
5. **Expiration** — Auto-delete after configurable period
6. **Audit trail** — All access logged

---

## 5. Service Types

### 5.1 Service Type Registry

From day 1, we define service types as a configurable registry:

| Service Type ID | Name | Description | Value Type A | Value Type B |
|-----------------|------|-------------|--------------|--------------|
| `TRAFFIC_BUY` | Canton Traffic Purchase | Buy traffic for a validator | USD (fiat) | Traffic (bytes) |
| `API_KEY_EXCHANGE` | API Key Exchange | Exchange payment for API access | USD (fiat) | API Key (string) |
| `DOCUMENT_DELIVERY` | Document Delivery | Pay for document delivery | USD (fiat) | Document (file) |
| `CRYPTO_OTC` | Crypto OTC Trade | P2P crypto exchange | Crypto A | Crypto B |
| `CUSTOM` | Custom Escrow | User-defined terms | Any | Any |

### 5.2 Service Type Schema

```json
{
  "service_type_id": "TRAFFIC_BUY",
  "name": "Canton Traffic Purchase",
  "description": "Buy Canton Network traffic for a validator",
  "party_a_delivers": {
    "type": "FIAT_USD",
    "label": "Payment",
    "required": true
  },
  "party_b_delivers": {
    "type": "CANTON_TRAFFIC",
    "label": "Traffic",
    "required": true,
    "metadata_schema": {
      "validator_party_id": "string",
      "traffic_bytes": "integer"
    }
  },
  "auto_acceptable": true,
  "requires_confirmation": {
    "party_a": true,
    "party_b": true
  }
}
```

---

## 4. User & Balance System

### 4.1 User Types

| Type | Description | Balance Tracked | Persistence |
|------|-------------|-----------------|-------------|
| **Unauthenticated** | Session-based user | Yes | Session + 30 days |
| **Authenticated** | Logged in user | Yes | Permanent |
| **Provider** | Can fulfill requests | Yes | Permanent |

### 4.2 Two-Bucket Balance Model

Every user has a account with two buckets:

```
┌─────────────────────────────────────────────────────────┐
│                    TOTAL BALANCE                         │
│                       $100.00                            │
├─────────────────────────┬───────────────────────────────┤
│   AVAILABLE BALANCE     │     IN CONTRACT BALANCE       │
│        $25.00           │          $75.00               │
│   (can withdraw/use)    │   (locked in active escrows)  │
└─────────────────────────┴───────────────────────────────┘
```

**Balance States:**

| Event | Available | In Contract | Total |
|-------|-----------|-------------|-------|
| Deposit $100 | +$100 | — | $100 |
| Create escrow request ($75) | -$75 | +$75 | $100 |
| Escrow completes (released to provider) | — | -$75 | $25 |
| Escrow canceled (returned) | +$75 | -$75 | $100 |
| Withdraw $25 | -$25 | — | $75 |

### 4.3 Ledger Entries

Every balance change creates a ledger entry:

```
┌─────────────┬────────────┬─────────┬─────────────┬─────────────────┬───────────────┐
│ entry_id    │ user_id    │ amount  │ bucket      │ type            │ reference_id  │
├─────────────┼────────────┼─────────┼─────────────┼─────────────────┼───────────────┤
│ 1           │ john_123   │ +100.00 │ available   │ DEPOSIT         │ stripe_abc    │
│ 2           │ john_123   │ -75.00  │ available   │ ESCROW_LOCK     │ escrow_001    │
│ 3           │ john_123   │ +75.00  │ in_contract │ ESCROW_LOCK     │ escrow_001    │
│ 4           │ john_123   │ -75.00  │ in_contract │ ESCROW_RELEASE  │ escrow_001    │
│ 5           │ ore_456    │ +63.75  │ available   │ ESCROW_RECEIVE  │ escrow_001    │
└─────────────┴────────────┴─────────┴─────────────┴─────────────────┴───────────────┘
```

---

## 5. Escrow Flow

### 5.1 State Machine

```
┌──────────────┐
│   CREATED    │  Party A creates escrow request
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   PENDING    │  Waiting for Party B to accept
│   ACCEPTANCE │  (or auto-accepted by matching provider)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   PENDING    │  Waiting for Party A to fund
│   FUNDING    │  (or already funded if deposited)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   FUNDED     │  Funds locked in escrow
│   (ACTIVE)   │  Party B notified to fulfill
└──────┬───────┘
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
┌──────────────┐                  ┌──────────────┐
│  PARTY_B     │                  │  DISPUTED    │
│  CONFIRMED   │                  │              │
└──────┬───────┘                  └──────────────┘
       │
       ▼
┌──────────────┐
│  PARTY_A     │
│  CONFIRMED   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  COMPLETED   │  Funds released to Party B
└──────────────┘

Alternative endings:
┌──────────────┐
│  CANCELED    │  Funds returned to Party A
└──────────────┘
┌──────────────┐
│  EXPIRED     │  Time limit exceeded
└──────────────┘
```

### 5.2 Detailed Flow: Traffic Buy (First Use Case)

```
STEP 1: REQUEST CREATION
─────────────────────────
John (Party A) visits platform
  → Selects: TRAFFIC_BUY service
  → Enters: validator_party_id
  → Enters: amount wanted ($100 worth)
  → System calculates: ~1,666,666 bytes
  → Creates: Escrow request (status: PENDING_ACCEPTANCE)

STEP 2: ACCEPTANCE
──────────────────
Option A: Auto-accepted
  → Ore has auto-accept rule: TRAFFIC_BUY up to $500 ✓
  → System matches and auto-accepts
  → Status: PENDING_FUNDING

Option B: Manual acceptance
  → Request appears in provider marketplace
  → Ore reviews and clicks "Accept"
  → Status: PENDING_FUNDING

STEP 3: FUNDING
───────────────
John pays via Stripe
  → Stripe webhook received
  → John's balance: Available -$100, In Contract +$100
  → Escrow status: FUNDED (ACTIVE)
  → Ore notified: "Escrow funded, please fulfill"

STEP 4: FULFILLMENT
───────────────────
Ore executes the action:
  → Calls Canton API: POST /api/validator/v0/wallet/buy-traffic-requests
  → Traffic purchased for John's validator
  → Ore clicks "I've completed my part"
  → Status: PARTY_B_CONFIRMED

STEP 5: CONFIRMATION
────────────────────
John confirms receipt:
  → Checks validator traffic (increased)
  → Clicks "I confirm I received the traffic"
  → Status: PARTY_A_CONFIRMED → COMPLETED

STEP 6: RELEASE
───────────────
Funds released:
  → John's balance: In Contract -$100
  → Ore's balance: Available +$85 (after 15% platform fee)
  → Platform fee: $15
  → Escrow status: COMPLETED
```

---

## 6. Provider System

### 6.1 Provider Settings

Providers can configure auto-accept rules:

```json
{
  "provider_id": "ore_456",
  "settings": {
    "auto_accept_rules": [
      {
        "service_type": "TRAFFIC_BUY",
        "enabled": true,
        "max_amount_usd": 500,
        "min_amount_usd": 10
      },
      {
        "service_type": "API_KEY_EXCHANGE",
        "enabled": false
      }
    ],
    "notification_preferences": {
      "email": true,
      "webhook_url": "https://ore.example.com/webhook"
    }
  }
}
```

### 6.2 Provider Capabilities

```json
{
  "provider_id": "ore_456",
  "capabilities": [
    {
      "service_type": "TRAFFIC_BUY",
      "metadata": {
        "canton_validator_url": "https://ledger-orph.validator...",
        "has_cc_balance": true,
        "max_traffic_bytes": 100000000
      }
    }
  ]
}
```

---

## 7. Database Schema (PostgreSQL)

### 7.1 Core Tables

```sql
-- Organizations (multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    billing_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),  -- For auth provider ID
    email VARCHAR(255),
    display_name VARCHAR(255),
    avatar_url TEXT,
    is_authenticated BOOLEAN DEFAULT false,
    is_provider BOOLEAN DEFAULT false,
    session_id VARCHAR(255),  -- For unauthenticated users
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Organization Members (many-to-many: users ↔ organizations)
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',  -- 'admin', 'member', 'viewer'
    can_use_org_account BOOLEAN DEFAULT true,
    can_create_escrows BOOLEAN DEFAULT true,
    can_manage_members BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Accounts (can belong to user OR organization)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),           -- NULL if org account
    organization_id UUID REFERENCES organizations(id),  -- NULL if personal account
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
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    amount DECIMAL(20, 8) NOT NULL,
    bucket VARCHAR(20) NOT NULL,  -- 'available' or 'in_contract'
    entry_type VARCHAR(50) NOT NULL,  -- DEPOSIT, WITHDRAW, ESCROW_LOCK, ESCROW_RELEASE, etc.
    reference_type VARCHAR(50),  -- 'escrow', 'stripe_payment', etc.
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Service Types Registry
CREATE TABLE service_types (
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
CREATE TABLE escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type_id VARCHAR(50) REFERENCES service_types(id),
    party_a_user_id UUID REFERENCES users(id),
    party_b_user_id UUID REFERENCES users(id),
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    platform_fee DECIMAL(20, 8),
    metadata JSONB,  -- Service-specific data (e.g., validator_party_id)
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
CREATE TABLE escrow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID REFERENCES escrows(id),
    event_type VARCHAR(50) NOT NULL,
    actor_user_id UUID REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Provider Settings
CREATE TABLE provider_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE stripe_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE canton_traffic_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID REFERENCES users(id),
    attachment_type VARCHAR(20) NOT NULL,  -- 'DOCUMENT', 'IMAGE', 'TEXT', 'ARCHIVE', 'LINK'
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    storage_path TEXT,  -- S3/R2 path or encrypted local path
    storage_provider VARCHAR(20) DEFAULT 'local',  -- 'local', 's3', 'r2'
    checksum_sha256 VARCHAR(64),
    encryption_key_id VARCHAR(255),  -- Reference to key management
    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',  -- 'UPLOADED', 'ESCROWED', 'RELEASED', 'DELETED'
    released_to_user_id UUID REFERENCES users(id),
    released_at TIMESTAMP,
    expires_at TIMESTAMP,
    metadata JSONB,  -- Additional info (e.g., for TEXT type, can store the actual content)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Attachment Access Log (audit trail for downloads)
CREATE TABLE attachment_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attachment_id UUID REFERENCES attachments(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(20) NOT NULL,  -- 'VIEW', 'DOWNLOAD', 'RELEASE'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_org_members_org ON org_members(organization_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_org_id ON accounts(organization_id);
CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id);
CREATE INDEX idx_escrows_party_a ON escrows(party_a_user_id);
CREATE INDEX idx_escrows_party_b ON escrows(party_b_user_id);
CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrow_events_escrow_id ON escrow_events(escrow_id);
CREATE INDEX idx_attachments_escrow ON attachments(escrow_id);
CREATE INDEX idx_attachments_status ON attachments(status);
CREATE INDEX idx_attachment_access_log_attachment ON attachment_access_log(attachment_id);
```

### 7.2 Initial Service Type Data

```sql
INSERT INTO service_types (id, name, description, party_a_delivers, party_b_delivers, platform_fee_percent, metadata_schema) VALUES
(
    'TRAFFIC_BUY',
    'Canton Traffic Purchase',
    'Buy Canton Network traffic for a validator that has run out of bandwidth',
    '{"type": "FIAT_USD", "label": "Payment"}',
    '{"type": "CANTON_TRAFFIC", "label": "Traffic (bytes)"}',
    15.00,
    '{"validator_party_id": "string", "traffic_amount_bytes": "integer", "domain_id": "string"}'
),
(
    'API_KEY_EXCHANGE',
    'API Key Exchange',
    'Exchange payment for API key access',
    '{"type": "FIAT_USD", "label": "Payment"}',
    '{"type": "API_KEY", "label": "API Key"}',
    10.00,
    '{"api_name": "string", "duration_days": "integer"}'
),
(
    'DOCUMENT_DELIVERY',
    'Document Delivery',
    'Pay for secure document delivery',
    '{"type": "FIAT_USD", "label": "Payment"}',
    '{"type": "DOCUMENT", "label": "Document"}',
    10.00,
    '{"document_description": "string"}'
);
```

---

## 8. API Endpoints

### 8.1 User & Account

```
GET    /api/user/me                      # Get current user profile
POST   /api/user/session                 # Create session (unauthenticated)
GET    /api/account                       # Get account balances (personal)
GET    /api/account/ledger                # Get ledger entries
POST   /api/account/deposit               # Initiate deposit (returns Stripe URL)
POST   /api/account/withdraw              # Request withdrawal
```

### 8.2 Organizations

```
GET    /api/orgs                         # List my organizations
POST   /api/orgs                         # Create new organization
GET    /api/orgs/:id                     # Get organization details
PUT    /api/orgs/:id                     # Update organization
DELETE /api/orgs/:id                     # Delete organization (admin only)

GET    /api/orgs/:id/members             # List organization members
POST   /api/orgs/:id/members             # Invite member to organization
PUT    /api/orgs/:id/members/:userId     # Update member role/permissions
DELETE /api/orgs/:id/members/:userId     # Remove member

GET    /api/orgs/:id/account              # Get organization account
GET    /api/orgs/:id/account/ledger       # Get organization ledger entries
POST   /api/orgs/:id/account/deposit      # Deposit to org account
```

### 8.3 Escrow

```
GET    /api/escrows                      # List my escrows (as party A or B)
POST   /api/escrows                      # Create new escrow request
GET    /api/escrows/:id                  # Get escrow details
POST   /api/escrows/:id/accept           # Accept escrow (Party B)
POST   /api/escrows/:id/fund             # Fund escrow (returns Stripe URL if needed)
POST   /api/escrows/:id/confirm          # Confirm completion (either party)
POST   /api/escrows/:id/cancel           # Cancel escrow
POST   /api/escrows/:id/dispute          # Raise dispute
GET    /api/escrows/:id/events           # Get escrow event history
```

### 8.4 Attachments

```
GET    /api/escrows/:id/attachments           # List attachments on escrow
POST   /api/escrows/:id/attachments           # Upload attachment
GET    /api/escrows/:id/attachments/:attId    # Get attachment metadata
GET    /api/escrows/:id/attachments/:attId/download  # Download attachment (if authorized)
DELETE /api/escrows/:id/attachments/:attId    # Delete attachment (before escrow funded)
POST   /api/escrows/:id/attachments/:attId/release   # Release attachment to other party
```

### 8.5 Service Types

```
GET    /api/service-types                # List available service types
GET    /api/service-types/:id            # Get service type details
```

### 8.6 Provider

```
GET    /api/provider/settings            # Get my provider settings
PUT    /api/provider/settings            # Update provider settings
GET    /api/provider/requests            # List pending requests I can accept
POST   /api/provider/execute/:escrow_id  # Execute service (e.g., buy traffic)
```

### 8.7 Webhooks (Internal)

```
POST   /api/webhooks/stripe              # Stripe payment webhook
```

---

## 9. Traffic Buy Calculation

### 9.1 Pricing Formula

Based on current Canton Network rates (~$60/MB):

```
traffic_bytes = (usd_amount / rate_per_mb) × 1,000,000

Where:
- rate_per_mb ≈ $60 (set by Super Validators, may fluctuate)
- 1 MB = 1,000,000 bytes
```

### 9.2 Examples

| Payment | Rate | Traffic (bytes) | Traffic (MB) |
|---------|------|-----------------|--------------|
| $60 | $60/MB | 1,000,000 | 1.00 MB |
| $100 | $60/MB | 1,666,666 | 1.67 MB |
| $200 | $60/MB | 3,333,333 | 3.33 MB |

### 9.3 Canton API Call

```bash
curl -X POST 'https://VALIDATOR_URL/api/validator/v0/wallet/buy-traffic-requests' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer PROVIDER_TOKEN' \
  --data '{
    "receiving_validator_party_id": "TARGET_VALIDATOR_PARTY_ID",
    "domain_id": "global-domain::1220b1431ef217342db44d516bb9befde802be7d8899637d290895fa58880f19accc",
    "traffic_amount": 1666666,
    "tracking_id": "escrow_abc123",
    "expires_at": 1760558843000000
  }'
```

---

## 10. Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js + Express (or Fastify) |
| **Database** | PostgreSQL (Railway) |
| **Payments** | Stripe Checkout + Webhooks |
| **Auth** | Clerk or Auth0 (optional, supports unauthenticated) |
| **Frontend** | Next.js (single page initially) |
| **Hosting** | Railway |
| **Canton Integration** | REST API calls to validator |

---

## 11. MVP Scope (Phase 1)

### 11.1 Features

- [ ] Single-page UI for TRAFFIC_BUY service
- [ ] Unauthenticated user flow (session-based)
- [ ] Account with two-bucket balance tracking (Available + In Contract)
- [ ] Stripe Checkout integration
- [ ] Single provider (Ore) with auto-accept
- [ ] Canton traffic purchase execution
- [ ] Basic confirmation flow
- [ ] PostgreSQL on Railway
- [ ] **Document attachments** (from day 1 — upload/release flow)
- [ ] **Basic organization support** (create org, add members)

### 11.2 Not in MVP

- Full authentication (Clerk/Auth0) — session-based is fine
- Multiple providers / marketplace
- Other service types beyond TRAFFIC_BUY
- Disputes handling
- Withdrawal to bank
- Mobile UI
- Org billing / invoicing

---

## 12. Future Roadmap

### Phase 2: Multi-Provider
- Provider registration
- Provider marketplace
- Rating system
- Multiple auto-accept rules

### Phase 3: Multi-Service
- Additional service types
- Custom escrow terms
- Document upload/delivery
- API key generation

### Phase 4: Tokenization
- Canton Network smart contracts
- On-chain escrow
- CC payment option
- Decentralized dispute resolution

---

## 13. Security Considerations

1. **Fund Safety** — Stripe handles payment security
2. **Provider Verification** — Initially manual, later KYC
3. **Escrow Timeout** — Auto-cancel if not completed within X days
4. **Audit Trail** — Immutable ledger entries
5. **Rate Limiting** — Prevent abuse
6. **Webhook Verification** — Validate Stripe signatures

---

## 14. Open Questions

1. What happens if provider fails to deliver? (Dispute flow)
2. How long before escrow auto-expires?
3. Refund policy if Canton API fails?
4. Platform fee structure (flat vs percentage)?
5. KYC requirements for providers?

---

## Appendix A: Sample UI Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     ESCROW SERVICE                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  YOUR BALANCE                                            │   │
│  │  Total: $0.00                                           │   │
│  │  ├── Available: $0.00                                   │   │
│  │  └── In Contract: $0.00                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BUY TRAFFIC FOR YOUR VALIDATOR                          │   │
│  │                                                          │   │
│  │  Validator Party ID:                                     │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ auth0_007c68d2894fe33775a90f6235ef::1220be...     │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  Amount (USD):                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ $100                                                │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  You'll receive: ~1.67 MB of traffic                    │   │
│  │  Platform fee: $15.00 (15%)                             │   │
│  │  Total charge: $115.00                                  │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │           PAY WITH STRIPE  →                       │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Escrow Status Values

| Status | Description |
|--------|-------------|
| `CREATED` | Initial state |
| `PENDING_ACCEPTANCE` | Waiting for provider to accept |
| `PENDING_FUNDING` | Accepted, waiting for payment |
| `FUNDED` | Payment received, provider can execute |
| `PARTY_B_CONFIRMED` | Provider confirmed execution |
| `PARTY_A_CONFIRMED` | Requestor confirmed receipt |
| `COMPLETED` | Both confirmed, funds released |
| `CANCELED` | Canceled by either party |
| `EXPIRED` | Time limit exceeded |
| `DISPUTED` | Under dispute review |

---

*End of Specification*
