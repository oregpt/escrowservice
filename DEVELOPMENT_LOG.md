# EscrowService Development Log

## Project Overview
EscrowService is a full-stack escrow platform built with React (Vite) frontend and Express.js backend, using PostgreSQL for data persistence.

---

## Latest Session: December 21, 2025 (Continued)

### Account Restructure: Per-User-Per-Org Wallets

Implemented a new account structure where users have personal wallets within each organization they belong to.

**Account Types:**
- **Organization Wallet** (`account_type='organization'`): Shared wallet for the org, `user_id=NULL`
- **Personal Wallet** (`account_type='personal'`): Per-user-per-org wallet, `user_id` + `organization_id` both set

**Example:** If a user belongs to 3 organizations, they have:
- 3 Organization Wallets (shared with org members)
- 3 Personal Wallets (one per org, only they can use)

#### Database Changes (`migrate.ts`)
- Dropped old `account_owner_check` constraint (prevented having both user_id + org_id)
- Added new `account_type_check` constraint requiring `organization_id IS NOT NULL`
- Added `account_type` column: `'organization'` or `'personal'`
- Created unique index on `(organization_id, user_id, currency)`
- Data migration: Existing personal-only accounts assigned to user's primary org

#### Backend API Changes

**`account.service.ts`:**
- Added `getAllAccountsForUser(userId)`: Returns all org + personal accounts with org names
- Added `getOrCreatePersonalAccount(userId, orgId)`: Get/create personal wallet within org

**`account.routes.ts`:**
- Added `GET /api/accounts/all`: Returns all user's accounts with `accountType` and `organizationName`
- Updated `POST /api/accounts/deposit`: Now accepts `orgId` and `accountType` to specify target wallet

**`stripe.service.ts`:**
- Updated `createCheckoutSession()` to accept `{ accountType, orgId }` metadata
- Updated webhook handler to credit the correct account based on metadata

#### Frontend Changes

**`client/src/lib/api.ts`:**
- Added `AccountWithOrgInfo` interface with `accountType` and `organizationName`
- Added `accounts.getAll()` method
- Added `accounts.depositToAccount(amount, orgId, accountType, currency)` method

**`client/src/hooks/use-api.ts`:**
- Added `useAllAccounts()` hook
- Added `useDepositToAccount()` mutation

**`client/src/pages/account.tsx`:**
- New "Balances" card with filter checkboxes: Organization / Personal
- Account list showing all wallets with type badges and org names
- Summary totals update based on filter selection
- "Add Funds" now has wallet selector dropdown
- Quick Stats show wallet counts by type

**UI Filter Behavior:**
- Both checked (default): Shows all accounts
- Only Organization: Shows org wallets only
- Only Personal: Shows personal wallets only
- Totals reflect filtered accounts

---

## Earlier: December 21, 2025

### Features Implemented This Session

#### 1. Password Reset (Forgot Password) Feature
Complete email-based password reset flow.

**Backend:**
- `backend/src/db/migrate.ts`: Added `password_reset_tokens` table
- `backend/src/routes/auth.routes.ts`: Added endpoints:
  - `POST /api/auth/forgot-password` - Request reset email
  - `POST /api/auth/reset-password` - Reset with token
  - `GET /api/auth/reset-password/:token` - Validate token
- `backend/src/services/email.service.ts`: Nodemailer-based email service

**Frontend:**
- `client/src/pages/reset-password.tsx`: Reset password page (accessed via email link)
- `client/src/components/layout/Header.tsx`: Added "Forgot password?" link in sign in dialog
- `client/src/hooks/use-api.ts`: Added `useForgotPassword`, `useValidateResetToken`, `useResetPassword` hooks
- `client/src/lib/api.ts`: Added auth API methods for password reset

**Environment Variables (for email):**
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-password
SMTP_FROM=noreply@yourapp.com
```

**Note:** If SMTP not configured, reset tokens are logged to console for development.

---

#### 2. Sign Up Button & Improved Auth Flow
- Added separate **Sign In** and **Sign Up** buttons in header (was only Sign In)
- Sign Up shows: Username, Email, Password, Display Name (optional)
- "Save Account" banner now works without existing session (uses register instead of convert)

---

#### 3. Platform Admin Only: Create Organization
- "Create Organization" button in org dropdown now only visible to `platform_admin` role
- Previously visible to both `admin` and `platform_admin`

---

#### 4. Confirmation Forms with Attachments
Added modal-based confirmation forms for Fund and Confirm actions that support notes, file attachments, and escrow-until-completion option.

**The Feature:**
- When clicking **Fund** or **Confirm** buttons on deal cards, a modal opens with:
  - Text field for notes/info
  - File upload capability
  - Checkbox: "Hold attachment until both parties confirm"
- Supports **$0 document deals** where the "deliverable" is a document held until completion
- Different modal titles/descriptions for each step:
  - **Funding**: "Fund Escrow" - For Party A to fund the deal
  - **Party B Confirm**: "Confirm Delivery" - Provider confirms they delivered
  - **Party A Confirm**: "Confirm Receipt" - Requestor confirms they received

**Attachment Escrow Flow:**
```
Party A uploads document with "Hold until completion" checked
  → Document is ESCROWED (neither party can access)
  → Party B confirms delivery
  → Party A confirms receipt
  → Document RELEASED to Party B
```

**Files Created:**
- `client/src/components/escrow/ConfirmationFormModal.tsx` - Modal component with form

**Files Modified:**

**Database:**
- `backend/src/db/migrate.ts`:
  - Added `hold_until_completion` BOOLEAN column to attachments
  - Added `confirmation_step` VARCHAR(30) column (FUNDING, PARTY_B_CONFIRM, PARTY_A_CONFIRM)
  - Added `notes` TEXT column to attachments

**Backend:**
- `backend/src/types/index.ts`:
  - Added `ConfirmationStep` type
  - Updated `Attachment` interface with new fields
- `backend/src/services/attachment.service.ts`:
  - Updated `uploadAttachment()` to accept options object
  - Added support for holdUntilCompletion, confirmationStep, notes
- `backend/src/routes/attachment.routes.ts`:
  - Upload now accepts `confirmationStep`, `holdUntilCompletion`, `notes` fields
- `backend/src/routes/escrow.routes.ts`:
  - Fund endpoint now accepts `notes` in request body
  - Confirm endpoint now accepts `notes` in request body
  - Notes are saved as escrow messages with `[Funding Notes]` or `[Confirmation Notes]` prefix

**Frontend:**
- `client/src/lib/api.ts`:
  - Added `ConfirmationStep` type
  - Updated `attachments.upload()` to accept options
  - Updated `escrows.fund()` and `escrows.confirm()` to accept notes
- `client/src/hooks/use-api.ts`:
  - Updated `useFundEscrow` to accept `{ id, notes }` object
  - Updated `useConfirmEscrow` to accept `{ id, notes }` object
  - Updated `useUploadAttachment` to accept new options
- `client/src/lib/types.ts`:
  - Extended `EscrowCardProps` with modal action handlers
- `client/src/components/escrow/EscrowCard.tsx`:
  - Added modal state management
  - Extended props for `onFundWithData`, `onConfirmWithData`, `confirmStep`
  - Opens modal when Fund/Confirm buttons clicked
  - Renders `ConfirmationFormModal`
- `client/src/pages/dashboard.tsx`:
  - Added `useUploadAttachment` hook
  - Added `handleFundWithData()` - uploads attachment then funds
  - Added `handleConfirmWithData()` - uploads attachment then confirms
  - Passes new handlers to EscrowCard
- `client/src/pages/escrow-list.tsx`:
  - Same updates as dashboard.tsx

**ConfirmationFormModal Interface:**
```typescript
interface ConfirmationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: 'FUNDING' | 'PARTY_B_CONFIRM' | 'PARTY_A_CONFIRM';
  escrowId: string;
  amount?: number;
  currency?: string;
  onSubmit: (data: {
    notes: string;
    file?: File;
    holdUntilCompletion: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}
```

---

#### 2. Action Buttons on Deal Cards (NEW)
Added dynamic action buttons to deal cards based on escrow status and user role.

**Available Actions:**
| Action | When Available | Button Style |
|--------|----------------|--------------|
| Accept | Pending + user is assigned or open offer | Green |
| Fund | Pending Funding + user is Party A | Amber |
| Confirm | Funded + user is Party B, OR Party B Confirmed + user is Party A | Blue |
| Cancel | Pending + user is Party A (originator) | Red outline |

**Files Modified:**
- `client/src/lib/types.ts` - Added action props to `EscrowCardProps`:
  - `canAccept`, `onAccept`, `isAccepting`
  - `canFund`, `onFund`, `isFunding`
  - `canConfirm`, `onConfirm`, `isConfirming`
  - `canCancel`, `onCancel`, `isCanceling`
- `client/src/components/escrow/EscrowCard.tsx` - Renders action buttons conditionally
- `client/src/pages/dashboard.tsx` - Passes action handlers and state
- `client/src/pages/escrow-list.tsx` - Same updates

---

#### 3. Cancellation Rules Update (SECURITY FIX)
Refined cancellation rules to prevent abuse after counterparty accepts.

**Previous Behavior:**
- Party A could cancel anytime before completion

**New Behavior:**
- Party A can **only cancel before Party B accepts** (PENDING status)
- Once accepted (PENDING_FUNDING, FUNDED, etc.), **neither party can cancel**
- Only platform arbiter can cancel after acceptance

**Rationale:**
- Once Party B accepts, they may start work immediately
- Allowing cancellation after acceptance would let Party A waste Party B's time
- Funded escrows already blocked cancellation (previous security fix)
- This extends protection to the acceptance phase

**Files Modified:**
- `client/src/pages/dashboard.tsx`:
  - `getEscrowActions()` - `canCancel` only true for `status === 'PENDING'`
- `client/src/pages/escrow-list.tsx`:
  - `transformEscrow()` - Same logic

---

### Updated Escrow Status Rules

| Status | Party A Can Cancel | Party B Can Cancel | Arbiter Can Cancel |
|--------|-------------------|-------------------|-------------------|
| PENDING | ✅ Yes | N/A (not assigned) | ✅ Yes |
| PENDING_ACCEPTANCE | ❌ No | ❌ No | ✅ Yes |
| PENDING_FUNDING | ❌ No | ❌ No | ✅ Yes |
| FUNDED | ❌ No | ❌ No | ✅ Yes |
| PARTY_B_CONFIRMED | ❌ No | ❌ No | ✅ Yes |
| PARTY_A_CONFIRMED | ❌ No | ❌ No | ✅ Yes |
| COMPLETED | ❌ No | ❌ No | ❌ No |

---

### UI/UX Improvements

- **Terminology Change**: "Escrow" → "Deal" throughout the UI for clarity
- **Dashboard Role Filters**: Added "All Other" checkbox to view deals where user is neither originator nor counterparty
- **Open Offer Handling**: Fixed open offers incorrectly appearing in green "assigned to you" section
- **Messaging Restrictions**: Messages restricted on open offers until someone accepts

---

## Session: December 20, 2025

### API Endpoint Testing & Report

Performed comprehensive automated testing of all 45 API endpoints.

**Results:**
- **Total Endpoints Tested:** 45
- **Passed:** 45
- **Failed:** 0

**Categories Tested:**
| Category | Tested | Passed |
|----------|--------|--------|
| Public Endpoints | 5 | 5 |
| Auth Endpoints | 5 | 5 |
| Account Endpoints | 4 | 4 |
| Payment Endpoints | 4 | 4 |
| Escrow Endpoints | 10 | 10 |
| Organization Endpoints | 5 | 5 |
| Admin Endpoints | 9 | 9 |
| Settings Endpoints | 3 | 3 |

**Issues Found & Fixed:**
1. **Missing `payments` table** - Fixed by running database migration
2. **Stripe provider showing disabled** - Fixed `isConfigured()` to only require STRIPE_SECRET_KEY

**Documentation Created:**
- `API_TEST_REPORT.md` - Comprehensive test report with all requests and responses

See `API_TEST_REPORT.md` for full details including actual API calls, responses, and test artifacts.

---

## Session: December 19, 2025

### Features Implemented This Session

#### 1. Modular Payment Provider System (NEW)
Built a provider-agnostic payment system that supports multiple payment methods with easy extensibility.

**The Feature:**
- **Provider Interface**: All payment providers implement the same interface
- **Current Providers**:
  - Stripe (enabled) - Credit/debit card payments
  - Crypto Wallet (coming soon) - Cryptocurrency payments
  - Bank Transfer (coming soon) - ACH/wire transfers
- **Frontend UI**: Payment method selector with provider cards showing enabled/coming soon status
- **Database**: Provider-agnostic `payments` table with JSONB for provider-specific data

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                    PAYMENT SERVICE (Orchestrator)                    │
│                                                                      │
│  class PaymentService {                                              │
│    registerProvider(provider)                                        │
│    getAvailableProviders(): ProviderInfo[]                          │
│    initiate(request): Promise<PaymentSession>                       │
│    verify(paymentId): Promise<PaymentResult>                        │
│    handleWebhook(provider, payload): Promise<void>                  │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ StripeProvider  │ │ CryptoProvider  │ │ BankProvider    │
│ (enabled)       │ │ (coming soon)   │ │ (coming soon)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**Files Created:**
- `backend/src/services/payment/types.ts` - PaymentProvider interface and types
- `backend/src/services/payment/payment.service.ts` - Orchestrator service
- `backend/src/services/payment/providers/stripe.provider.ts` - Stripe implementation
- `backend/src/services/payment/providers/crypto.provider.ts` - Crypto placeholder
- `backend/src/services/payment/providers/bank.provider.ts` - Bank placeholder
- `backend/src/services/payment/index.ts` - Module exports
- `backend/src/routes/payment.routes.ts` - Unified payment API routes
- `client/src/pages/payment-success.tsx` - Payment success page
- `client/src/pages/payment-cancel.tsx` - Payment cancel page

**Files Modified:**
- `backend/src/db/migrate.ts` - Added `payments` table
- `backend/src/routes/index.ts` - Added payment routes
- `backend/src/routes/webhook.routes.ts` - Multi-provider webhook handling
- `backend/src/index.ts` - Added payment endpoints to startup message
- `client/src/App.tsx` - Added payment routes
- `client/src/lib/api.ts` - Added payment types and API methods
- `client/src/hooks/use-api.ts` - Added payment hooks
- `client/src/pages/account.tsx` - Provider selection UI

**New API Endpoints:**
```
GET  /api/payments/providers    → List available providers
POST /api/payments/initiate     → Start payment with provider
GET  /api/payments/:id          → Get payment by ID
GET  /api/payments/:id/verify   → Verify payment status
GET  /api/payments               → Payment history

POST /webhooks/stripe           → Stripe webhook
POST /webhooks/crypto           → Future crypto webhook
```

**Database Schema:**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  escrow_id UUID,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider VARCHAR(30) NOT NULL,
  external_id VARCHAR(255),
  provider_data JSONB DEFAULT '{}',
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

**How to Add a New Provider:**
1. Create `backend/src/services/payment/providers/[name].provider.ts`
2. Implement `PaymentProvider` interface
3. Register in `PaymentService` constructor
4. Add webhook route if needed

---

#### 2. Custom Arbiter Feature (NEW)
Added the ability to choose a custom arbiter (third party) for dispute resolution instead of only platform admin.

**The Feature:**
- When creating an escrow, user can select who resolves disputes:
  - **Platform Only** (default) - Platform admin handles disputes
  - **Platform AI** (Coming Soon) - AI-powered dispute resolution (placeholder for future)
  - **Organization** - Any admin of specified org can resolve disputes
  - **Specific Person** - Designated person (by email) can resolve disputes
- Platform always retains override ability regardless of custom arbiter
- Arbiter can cancel (refund to Party A) or force-complete (release to Party B)

**UI Flow - Escrow Creation:**
```
Step 2: Counterparty → Privacy → Dispute Resolution (NEW)
  ○ Platform Only (Recommended)
  ○ Platform AI [Coming Soon badge] → Shows info box when selected, blocks proceeding
  ○ Third-Party Organization  → [Org ID input]
  ○ Specific Person          → [Email input]
```

**UI Flow - Escrow Detail:**
- Sidebar shows "Dispute Resolution" card with arbiter info
- If user IS the arbiter, shows "You are the arbiter" badge
- For funded escrows, arbiter sees action buttons:
  - "Cancel & Refund" → Opens dialog with reason input
  - "Force Release" → Opens dialog with reason input

**Files Changed:**

**Database:**
- `backend/src/db/migrate.ts`:
  - Added `arbiter_type` VARCHAR (platform_only/platform_ai/organization/person)
  - Added `arbiter_org_id` UUID FK to organizations
  - Added `arbiter_user_id` UUID FK to users
  - Added `arbiter_email` VARCHAR for invites
  - Added indexes for arbiter queries

**Backend:**
- `backend/src/types/index.ts`:
  - Added `ArbiterType` type (`'platform_only' | 'platform_ai' | 'organization' | 'person'`)
  - Updated `Escrow` interface with arbiter fields
  - Updated `EscrowWithParties` with arbiter org/user
  - Updated `CreateEscrowRequest` with arbiter selection
- `backend/src/services/escrow.service.ts`:
  - Added `isUserArbiter(userId, escrowId)` helper
  - Added `getEscrowsAsArbiter(userId)` query
  - Updated `createEscrow()` to accept arbiter params
  - Updated `mapRowToEscrow()` to include arbiter fields
- `backend/src/routes/admin.routes.ts`:
  - Added `requireArbiter` middleware (platform admin OR designated arbiter)
  - Updated cancel/force-complete routes to use arbiter check
  - Added `GET /api/admin/escrows/:id/is-arbiter`
  - Added `GET /api/admin/my-arbitrations`

**Frontend:**
- `client/src/lib/api.ts`:
  - Added `ArbiterType` type
  - Updated type definitions with arbiter fields
  - Added `arbiter` API namespace with methods
- `client/src/pages/escrow-new.tsx`:
  - Added arbiter selection UI in Step 2
  - Added arbiter state and validation
  - Added arbiter to review step
- `client/src/pages/escrow-detail.tsx`:
  - Added arbiter info card in sidebar
  - Added arbiter check query
  - Added arbiter action buttons for funded escrows
  - Added arbiter cancel/force-complete dialogs

**Permission Rules:**
| Role | Can Cancel Funded? | Can Force Complete? |
|------|-------------------|---------------------|
| Party A (after funded) | NO | NO |
| Party B | NO | NO |
| Custom Arbiter (org admin) | YES | YES |
| Custom Arbiter (person) | YES | YES |
| Platform Admin | ALWAYS | ALWAYS |

---

#### 2. Evidence Categorization (NEW)
Added `purpose` field to attachments to categorize what each attachment is proving or delivering.

**AttachmentPurpose Values:**
| Purpose | Description |
|---------|-------------|
| `evidence_a` | Party A proving they did their part |
| `evidence_b` | Party B proving they did their part |
| `deliverable_a` | The actual item Party A is delivering (e.g., payment receipt) |
| `deliverable_b` | The actual item Party B is delivering (e.g., document, API key) |
| `general` | General attachment (notes, context, etc.) |

**Files Changed:**
- `backend/src/db/migrate.ts` - Added `purpose` VARCHAR(30) column to attachments table
- `backend/src/types/index.ts` - Added `AttachmentPurpose` type and `purpose` field to Attachment interface
- `client/src/lib/api.ts` - Added `AttachmentPurpose` type and `purpose` field to frontend

---

#### 3. Obligation Tracking with Visual Display (NEW)
Added automatic obligation tracking for each escrow. Obligations are auto-generated from the service type and auto-completed when parties take action.

**How It Works:**
- **Auto-generated**: When escrow is created, obligations are generated from `service_types.party_a_delivers` and `party_b_delivers`
- **Auto-completed Party A**: When escrow is funded, Party A's obligation is marked complete
- **Auto-completed Party B**: When Party B confirms delivery, their obligation is marked complete
- **Zero extra clicks**: No additional user action required

**Visual Display on Escrow Detail:**
```
┌────────────────────────────────────────────────────────────────┐
│  Obligations                                                    │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✅ PARTY A (ORIGINATOR)                    [Complete]    │  │
│  │    Payment: USD 500.00                                   │  │
│  │    Completed: Dec 19, 2025 at 10:30 AM                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⏳ PARTY B (COUNTERPARTY)                  [Pending]     │  │
│  │    Traffic (bytes)                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Obligation Interface:**
```typescript
interface Obligation {
  id: string;                    // 'obl_a' or 'obl_b'
  party: 'A' | 'B';
  description: string;           // Human-readable
  type: string;                  // From service_type
  status: 'pending' | 'completed' | 'disputed';
  completedAt?: string;
  evidenceAttachmentIds?: string[];
}
```

**Files Changed:**
- `backend/src/types/index.ts` - Added `Obligation`, `ObligationStatus`, `ObligationParty` types
- `backend/src/services/escrow.service.ts`:
  - `createEscrow()` - Auto-generates obligations from service type
  - `fundEscrow()` - Auto-completes Party A obligation
  - `confirmEscrow()` - Auto-completes Party B obligation when they confirm
  - `updateObligationStatus()` - Helper to update obligation in JSONB
  - `linkAttachmentToObligation()` - Links attachments to obligations
- `client/src/lib/api.ts` - Added Obligation types
- `client/src/pages/escrow-detail.tsx` - Added Obligations card with visual display

---

#### 4. Escrow Cancel Security Fix (CRITICAL)
Prevented the "do work then cancel" attack where Party A could fund an escrow, Party B performs irreversible work, then Party A cancels and gets refund.

**The Problem:**
```
1. Party A creates escrow for traffic purchase
2. Party B (provider) accepts
3. Party A funds the escrow
4. Party B performs traffic purchase (irreversible)
5. Party A cancels → gets refund, Party B loses out!
```

**The Fix:**
- Once escrow is `FUNDED`, **neither party can cancel**
- Only platform admin can intervene via dispute resolution

**Files Changed:**
- `backend/src/services/escrow.service.ts`:
  - `cancelEscrow()` - Now blocks cancel when status is FUNDED
  - `adminCancelEscrow()` - NEW: Admin override for dispute resolution
  - `adminForceComplete()` - NEW: Admin can force release to Party B
- `backend/src/routes/admin.routes.ts`:
  - `POST /api/admin/escrows/:id/cancel` - Admin cancel with reason
  - `POST /api/admin/escrows/:id/force-complete` - Admin force release
  - `GET /api/admin/escrows` - Admin view all escrows
- `backend/src/types/index.ts`:
  - Added `ADMIN_CANCELED` and `ADMIN_COMPLETED` event types

**New Rules:**
| Status | User Can Cancel? | Admin Can Cancel? |
|--------|------------------|-------------------|
| PENDING_ACCEPTANCE | Yes | Yes |
| PENDING_FUNDING | Yes | Yes |
| FUNDED | **NO** | Yes |
| COMPLETED | No | No |

---

#### 5. SSH SOCKS5 Proxy for IP-Whitelisted APIs
Implemented an SSH tunnel system to route API calls through a specific IP address. Required for Canton blockchain APIs that use IP whitelisting.

**Architecture:**
```
┌─────────────────┐     SSH Tunnel      ┌──────────────────┐     HTTPS      ┌─────────────────┐
│  EscrowService  │ ─────────────────── │  Proxy Server    │ ────────────── │  Canton API     │
│  (Backend)      │   SOCKS5 Proxy      │  (Whitelisted IP)│                │  (IP Whitelist) │
└─────────────────┘                     └──────────────────┘                └─────────────────┘
```

**Files Created:**
- `backend/src/services/ssh-tunnel.ts` - SSH tunnel manager with auto-reconnect
- `backend/src/services/proxied-http.ts` - HTTP client that routes through tunnel

**New Endpoints:**
- `GET /api/tunnel/status` - Check tunnel connection status
- `POST /api/tunnel/reconnect` - Manually trigger reconnection

**Environment Variables:**
```bash
SSH_HOST=your-proxy-server.com
SSH_USER=root
SSH_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----\n..."
SSH_PORT=22
SOCKS_PROXY_PORT=8080
```

**How It Works:**
1. On server start, SSH tunnel is established to remote server
2. SOCKS5 proxy listens on localhost:8080
3. API calls use `proxiedPost()` which routes through tunnel
4. DNS is resolved through proxy (socks5h://) for IP whitelisting
5. Auto-reconnects on connection drop (up to 5 attempts)

**Usage:**
```typescript
import { proxiedPost, isTunnelConnected } from './services/proxied-http.js';

// Check if tunnel is available
if (isTunnelConnected()) {
  const response = await proxiedPost(
    'https://canton-api.example.com/endpoint',
    { data: 'payload' },
    { 'Authorization': 'Bearer token' }
  );
}
```

---

## Session: December 18, 2025

### Features Implemented

#### 1. Organization Management (Admin Panel)
- **Delete Organization**: Full implementation with safety checks
  - Checks for active escrows before deletion
  - Clears `primary_org_id` from users to avoid FK constraint violations
  - Deletes org members, accounts, then organization
  - Location: `backend/src/services/organization.service.ts` - `deleteOrganization()`

- **Member Management**: Complete CRUD for organization members
  - Fetch members when dialog opens
  - Add members by email with role selection (admin/member)
  - Change member roles via dropdown
  - Remove members with confirmation
  - Location: `client/src/pages/admin/organizations.tsx`

- **Removed "Suspend Org" option** - not needed for MVP

#### 2. Counterparty Visibility & Assignment
- **Email-based matching**: Users now see escrows assigned to their email
  - Updated `getEscrowsForUser()` and `getPendingEscrowsForProvider()` in escrow.service.ts
  - Matches on `counterparty_email` field

- **Organization ID flow for privacy**:
  - Removed organization dropdown from escrow creation (privacy concern)
  - Users now paste Organization ID manually
  - Org ID visible on Balances page with copy button
  - Location: `client/src/pages/escrow-new.tsx`, `client/src/pages/account.tsx`

- **Counterparty selection**: Choose Organization OR Email (not both)
  - Radio buttons for "Open", "Specific Organization", "Specific Person"
  - Location: `client/src/pages/escrow-new.tsx`

#### 3. Dashboard Improvements
- **Pending Notification Banner**: Prominent amber alert at top of dashboard
  - Shows count of pending escrows awaiting action
  - Breakdown: "X assigned to you • Y for your organization • Z open"
  - "Review Now" button scrolls to pending section
  - Location: `client/src/pages/dashboard.tsx:93-118`

- **Escrow Filter Tabs**: Categorize active escrows
  - Tabs: "All" | "My Escrows" | "Organization"
  - Shows counts for each category
  - Only visible when user is in an organization
  - Location: `client/src/pages/dashboard.tsx:282-297`

- **Organization ID Display**: Added to Balances page
  - Card showing user's organizations with copy button
  - Location: `client/src/pages/account.tsx:175-212`

#### 4. Header/Navigation Updates
- **Renamed "Account" to "Balances"** in navigation
- **Auto-select first organization**: Dropdown no longer shows "No Organization"
  - Auto-selects first org when user has organizations
  - Falls back to "Create Organization" if no orgs
  - Location: `client/src/components/layout/Header.tsx:52-59`

#### 5. Infrastructure Fixes
- **Vite Proxy Configuration**: Added proxy for API requests
  - `/api` and `/webhooks` forwarded to backend on port 3001
  - Location: `vite.config.ts`

- **Session Header Fix**: Added `X-Session-ID` header to organization creation
  - Fixed "Invalid session" error on org creation

---

## Key Files Modified This Session

### Frontend (client/src/)
| File | Changes |
|------|---------|
| `pages/dashboard.tsx` | Pending banner, filter tabs, escrow categorization |
| `pages/account.tsx` | Organization ID display with copy button |
| `pages/escrow-new.tsx` | Counterparty type selection (Org/Email), removed org dropdown |
| `pages/admin/organizations.tsx` | Delete org, member management |
| `components/layout/Header.tsx` | Auto-select org, renamed Account to Balances |

### Backend (backend/src/)
| File | Changes |
|------|---------|
| `services/organization.service.ts` | `deleteOrganization()` method |
| `services/escrow.service.ts` | Email-based counterparty matching |
| `routes/admin.routes.ts` | DELETE `/organizations/:id` endpoint |

---

## Database Schema Notes

### Key Tables
- `users` - User accounts with `primary_org_id` FK
- `organizations` - Organization entities
- `org_members` - Many-to-many user/org relationship with roles
- `escrows` - Escrow contracts with party A/B references
- `accounts` - Financial accounts (user or org)
- `ledger_entries` - Transaction history

### Important Constraints
- `users.primary_org_id` -> `organizations.id` (must clear before org delete)
- Escrows reference both user IDs and org IDs for parties

---

## Running the Application

### Start Backend
```bash
cd C:\Users\oreph\Documents\Canton\DAML Projects\EscrowService\frontend\backend
npm run dev
```

### Start Frontend (separate terminal)
```bash
cd C:\Users\oreph\Documents\Canton\DAML Projects\EscrowService\frontend
npm run dev:client
```

### URLs
- Frontend: http://localhost:5000
- Backend API: http://localhost:3001

### SSH Tunnel Configuration (Optional)
To enable IP-whitelisted API calls, add to `backend/.env`:
```bash
SSH_HOST=your-proxy-server.com
SSH_USER=root
SSH_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----\n..."
```

---

## Next Steps / TODO
- [ ] Test the complete escrow flow with org-based assignment
- [ ] Add user search/lookup when adding org members
- [ ] Implement escrow notifications (email/in-app)
- [ ] Add escrow expiration handling
- [ ] Consider adding escrow templates for common use cases

---

## Known Issues
- None currently blocking

---

## Session History

### December 21, 2025 (Current)
- **Confirmation Forms with Attachments** - Modal forms for Fund/Confirm with notes, file upload, and escrow-until-completion option
- **Action Buttons on Deal Cards** - Dynamic Accept/Fund/Confirm/Cancel buttons based on status and role
- **Cancellation Rules Update** - Only allow cancel before Party B accepts (PENDING status only)
- **UI/UX Improvements** - "Escrow" → "Deal" terminology, dashboard filters, open offer handling

### December 20, 2025
- **API Endpoint Testing** - Comprehensive testing of all 45 endpoints (100% pass rate)
- Fixed missing `payments` table issue
- Fixed Stripe provider configuration check

### December 19, 2025
- **Custom Arbiter Feature** - Choose org/person as arbiter for dispute resolution
- **Escrow Cancel Security Fix** - Block cancel after FUNDED, admin override only
- SSH SOCKS5 Proxy for IP-whitelisted APIs
- SSH tunnel manager with auto-reconnect
- Proxied HTTP client for Canton API calls
- Tunnel status/reconnect endpoints

### December 18, 2025
- Organization management (delete, members)
- Counterparty visibility and assignment
- Dashboard improvements (banner, tabs)
- Header navigation updates

### Previous Sessions
- Initial project setup
- Core escrow CRUD operations
- User authentication with sessions
- Stripe integration for deposits
- Platform settings and admin panel
