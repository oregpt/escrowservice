# EscrowService Development Log

## Project Overview
EscrowService is a full-stack escrow platform built with React (Vite) frontend and Express.js backend, using PostgreSQL for data persistence.

---

## Latest Session: December 27, 2025

### Features Implemented This Session

#### 1. Canton Loop SDK Integration (Wallet Funding)

**What It Does:**
Fund your EscrowService account using Canton Coin (CC) from your Canton wallet via the Loop SDK. This enables native blockchain payments alongside traditional credit card funding.

**Backend Implementation:**

*New Provider - `backend/src/services/payment/providers/loop.provider.ts`:*
- Full `PaymentProvider` interface implementation
- Exchange rate fetching from Kaiko API (CC/USD)
- Payment session creation with CC amount calculation
- Transfer verification with amount matching
- User wallet connection storage for returning users
- Canton transaction ID recording for audit

*New Routes - `backend/src/routes/loop.routes.ts`:*
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/loop/config` | GET | Get platform wallet info + exchange rate |
| `/api/payments/loop/create-session` | POST | Create pending payment session |
| `/api/payments/loop/verify-transfer` | POST | Verify completed transfer & credit account |
| `/api/payments/loop/save-wallet` | POST | Save user's wallet connection |
| `/api/payments/loop/wallet` | GET | Get user's saved wallet |
| `/api/payments/loop/wallet` | DELETE | Disconnect user's wallet |
| `/api/payments/loop/exchange-rate` | GET | Get current CC/USD rate |

*Database Tables Added (via migrate.ts):*
- `loop_transfers` - Records all Canton transfers with tx IDs, amounts, parties
  - Note: `payment_id` must be UUID type (not INTEGER) to match `payments.id`
- `user_loop_wallets` - Stores user wallet connections (party_id, public_key, email)

**Migration Fix (Dec 27):** The original migration had `payment_id INTEGER` but `payments.id` is UUID. Fixed to use `payment_id UUID` for proper compatibility.

**Frontend Implementation:**

*New Components:*
- `client/src/components/payment/LoopFundingModal.tsx` - Multi-step funding flow:
  1. Connect wallet (Loop SDK OAuth)
  2. Enter USD amount (auto-converts to CC)
  3. Review & confirm transfer
  4. Processing with wallet confirmation
  5. Success/error handling

*New Hooks:*
- `client/src/hooks/use-loop-wallet.ts` - Wallet connection & transfer management
- `client/src/lib/loop/loop-sdk.ts` - Loop SDK wrapper
- `client/src/lib/loop/loop-context.tsx` - React context for Loop state

*Integration Points:*
- Account page shows "Canton Wallet" as funding option when Loop is configured
- Real-time CC/USD exchange rate display with refresh button
- Network indicator (mainnet/testnet)
- Saved wallet detection for returning users

**Configuration Required:**
```env
LOOP_PLATFORM_PARTY_ID=auth0_xxx::1220xxx  # Platform receiving wallet
LOOP_NETWORK=mainnet                         # Network selection
KAIKO_API_KEY=xxx                            # For CC/USD price feed
```

**Payment Flow:**
```
1. User selects "Canton Wallet" funding option
2. Connects Loop wallet (OAuth popup)
3. Enters USD amount → sees CC equivalent
4. Confirms → Loop SDK initiates transfer
5. Backend verifies transfer amount
6. Account credited with USD equivalent
7. Canton TX ID stored for audit trail
```

---

## Previous Session: December 23, 2025 (Continued)

### Features Implemented This Session

#### 1. Enhanced Tokenization Status & Push-to-Blockchain

**New Status Display:**
- Show all 3 blockchain status values in TokenizeModal:
  - `syncStatus`: pending | synced | failed
  - `onchainStatus`: unchecked | local-only | onchain
  - `foundOnChain`: boolean (Yes/No)
- Added cyan "Tokenized" badge on escrow cards when tokenized

**Sync Improvements:**
- Fixed sync to use `POST /sync` (Canton blockchain lookup) instead of just `GET` (database read)
- Two-step sync: POST /sync triggers Canton lookup, then GET reads latest from database
- "Update Metadata" now always syncs first before updating

**Push-to-Blockchain Feature:**
- New `POST /api/registry/push/:escrowId` endpoint
- When `onchainStatus` is 'local-only', shows amber "Push to Blockchain" button
- Calls theRegistry's `POST /api/public/asset-registrations/:id/push` to re-push failed assets

**Already Tokenized Handling:**
- When clicking Tokenize on already-tokenized escrow, shows friendly prompt
- Prompt offers "Update Tokenization" button instead of confusing error

**Database Changes:**
- Added `onchain_status` column (VARCHAR, default 'unchecked')
- Added `found_on_chain` column (BOOLEAN, default false)

---

## Session: December 23, 2025 (Earlier)

### Features Implemented

#### 1. theRegistry Tokenization Integration
Added Canton blockchain tokenization via theRegistry platform. Escrows can now be registered as on-chain assets.

**The Feature:**
- Organizations can enable "Tokenization" feature flag
- When enabled, eligible escrows show a "Tokenize" button
- Tokenization creates an immutable on-chain record of the escrow
- Updates to tokenized escrows create new contracts (archives old)

**API Integration Learnings (for theRegistry API):**

*Request Format:*
1. Use `asset_type_id: 1` (number), not `assetType: "TrafficPurchase"` (string)
2. `fields` must be array format: `[{ key: 'assetName', value: '...' }, { key: 'assetDescription', value: '...' }]`
3. `attributes` must use `key` (not `trait_type`), all values must be strings (use `String(number)`)
4. `metadata` must be object (not JSON.stringify'd string)
5. Field keys are `assetName` and `assetDescription` (not `name` and `description`)
6. Required fields: `asset_type_id`, `wallet_address`, `network`, `fields`, `attributes`, `metadata`

*Response Format:*
7. Response is wrapped: `{success: true, data: {...}}`
8. Blockchain fields are nested: `data.blockchain.update_id`, `data.blockchain.contract_id`, etc.
9. Use `data.asset_registration_id` (not `id` at top level)
10. `contract_id` is **NULL initially** with `status: "pending"` - populated after async blockchain sync
11. `data.token_id` contains the unique blockchain token identifier

*See full API guide: `docs/theRegistry-API-Guide.md`*

**Sync Status Polling Feature:**
- `contract_id` is NULL immediately after tokenization (blockchain sync is async)
- Added "Check for Update" button in TokenizeModal when status is "pending"
- Button polls theRegistry API via `GET /api/public/asset-registrations/:id`
- If `contract_id` is now available, updates local record and shows "synced"
- Route: `POST /api/registry/sync/:escrowId`
- UI shows spinning loader while checking, toast notifications for results

**Files Created:**
- `backend/src/services/registry.service.ts` - theRegistry API service with encryption
- `client/src/components/org/OrgFeatureFlagsEditor.tsx` - Per-org feature flag management
- `client/src/components/escrow/TokenizationButton.tsx` - Tokenization UI component

**Files Modified:**
- `backend/src/db/migrate.ts`:
  - Added `org_registry_config` table (API key encrypted, wallet address, environment)
  - Added `tokenization_records` table (contract IDs, sync status, metadata)
  - Added `is_tokenized` column to escrows
- `backend/src/services/org-feature-flags.service.ts`:
  - Added 'tokenization' to AVAILABLE_FEATURES array
- `backend/src/services/platform-settings.service.ts`:
  - Added `registryApiUrl` for platform-level API URL config
- `client/src/pages/admin/settings.tsx`:
  - Added theRegistry section with API URL configuration
- `client/src/lib/api.ts`:
  - Added `FeatureKey` type with 'tokenization'
  - Added registry config API endpoints
  - Added `registry.syncStatus()` for polling contract_id availability
- `client/src/hooks/use-api.ts`:
  - Added `useSyncTokenizationStatus()` mutation hook
- `client/src/components/escrow/TokenizeModal.tsx`:
  - Added sync button next to "pending" status badge
  - Added `handleSyncStatus()` function with toast notifications
  - Added `refetchStatus()` calls after tokenize/update operations

**Configuration:**
- **Platform Level**: theRegistry API URL (Admin → Platform Settings)
- **Org Level**: API Key + Wallet Address (Org → Feature Flags → Tokenization toggle)

**Environment Update:**
- Removed testnet environment option
- Only mainnet (https://theregistry.agenticledger.ai) is supported

---

## Session: December 21, 2025

### Features Implemented

#### 2. Confirmation Forms with Attachments
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

---

#### 3. Cancellation Rules Update (SECURITY FIX)
Refined cancellation rules to prevent abuse after counterparty accepts.

**New Behavior:**
- Party A can **only cancel before Party B accepts** (PENDING status)
- Once accepted (PENDING_FUNDING, FUNDED, etc.), **neither party can cancel**
- Only platform arbiter can cancel after acceptance

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

## Running the Application

### Start Backend
```bash
cd C:\Users\oreph\Documents\Canton Apps\DAML Projects\EscrowService\backend
npm run dev
```

### Start Frontend (separate terminal)
```bash
cd C:\Users\oreph\Documents\Canton Apps\DAML Projects\EscrowService\frontend
npm run dev:client
```

### URLs
- Frontend: http://localhost:5000
- Backend API: http://localhost:3001

---

## Session History

### December 27, 2025 (Current)
- **Canton Loop SDK Integration** - Native Canton wallet funding via Loop SDK
- **CC/USD Exchange Rate** - Real-time pricing from Kaiko API
- **Wallet Connection Storage** - Remember user wallets for returning users
- **Multi-step Funding Modal** - Connect → Amount → Confirm → Transfer flow

### December 23, 2025
- **theRegistry Tokenization Integration** - Canton blockchain tokenization via theRegistry platform
- **Per-org Feature Flags UI** - Toggle tokenization per organization with inline config
- **API Integration** - Full theRegistry API integration with asset registration and metadata updates
- **Testnet Removal** - Simplified to mainnet-only configuration

### December 21, 2025
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
