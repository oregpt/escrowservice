# Escrow Service - Frontend Specification

**For:** Frontend Design Team (AI Agent)
**Purpose:** Design and code the UI/UX. Backend integration will be done separately.
**Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui

---

## 1. Overview

Build a modern, clean escrow platform UI. The first use case is purchasing Canton Network traffic, but the design should be generic enough for any two-party escrow service.

**Design Principles:**
- Clean, minimal, professional (fintech feel)
- Mobile-responsive
- Clear status indicators
- Easy-to-understand escrow flow

---

## 2. Pages & Routes

```
/                           → Landing / Dashboard
/escrow/new                 → Create new escrow request
/escrow/[id]                → Escrow detail page
/account                    → User account & balance
/org/[orgId]                → Organization dashboard
/org/[orgId]/members        → Manage org members
/org/[orgId]/account        → Organization account & balance
/settings                   → User settings
/provider                   → Provider dashboard (for fulfilling requests)
```

---

## 3. Component Structure

Please create these components. Use placeholder data/props — backend integration will be done later.

### 3.1 Layout Components

```
components/
├── layout/
│   ├── Header.tsx              # Top nav with logo, user menu
│   ├── Sidebar.tsx             # Left sidebar (optional, for dashboard)
│   ├── Footer.tsx              # Simple footer
│   └── PageContainer.tsx       # Wrapper with max-width, padding
```

### 3.2 Account Components

**Note:** We use "Account" not "Wallet" — it's a balance tracker.

```
components/
├── account/
│   ├── AccountSummary.tsx      # Shows total, available, in-contract
│   ├── AccountCard.tsx         # Compact balance display
│   ├── BalanceBuckets.tsx      # Visual split of available vs locked
│   ├── LedgerTable.tsx         # Transaction history table
│   ├── DepositButton.tsx       # Initiates Stripe deposit
│   └── WithdrawButton.tsx      # Request withdrawal (disabled initially)
```

**AccountSummary Props:**
```typescript
interface AccountSummaryProps {
  totalBalance: number;
  availableBalance: number;
  inContractBalance: number;
  currency: string; // 'USD'
  isLoading?: boolean;
}
```

**Visual Design:**
```
┌─────────────────────────────────────────────────────────┐
│  YOUR ACCOUNT                                           │
│                                                         │
│  Total Balance                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │            $1,250.00                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────┐ ┌──────────────────────┐     │
│  │  Available           │ │  In Contract         │     │
│  │  $750.00             │ │  $500.00             │     │
│  │  ████████░░░░        │ │  ░░░░░████████       │     │
│  │  60%                 │ │  40%                 │     │
│  └──────────────────────┘ └──────────────────────┘     │
│                                                         │
│  [+ Deposit]                          [Withdraw ↗]     │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Escrow Components

```
components/
├── escrow/
│   ├── EscrowCard.tsx          # Summary card for list view
│   ├── EscrowDetail.tsx        # Full detail view
│   ├── EscrowTimeline.tsx      # Visual status timeline
│   ├── EscrowStatus.tsx        # Status badge
│   ├── EscrowActions.tsx       # Action buttons based on state
│   ├── CreateEscrowForm.tsx    # Multi-step form to create escrow
│   ├── ServiceTypeSelector.tsx # Select escrow type (traffic, document, etc)
│   └── PartyInfo.tsx           # Show party A / party B info
```

**EscrowCard Props:**
```typescript
interface EscrowCardProps {
  id: string;
  serviceType: 'TRAFFIC_BUY' | 'DOCUMENT_DELIVERY' | 'API_KEY_EXCHANGE' | 'CUSTOM';
  status: EscrowStatus;
  amount: number;
  currency: string;
  partyA: { name: string; avatar?: string };
  partyB: { name: string; avatar?: string } | null;
  createdAt: string;
  expiresAt?: string;
}

type EscrowStatus =
  | 'CREATED'
  | 'PENDING_ACCEPTANCE'
  | 'PENDING_FUNDING'
  | 'FUNDED'
  | 'PARTY_B_CONFIRMED'
  | 'PARTY_A_CONFIRMED'
  | 'COMPLETED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'DISPUTED';
```

**EscrowTimeline Visual:**
```
○─────●─────○─────○─────○─────○
│     │     │     │     │     │
Created  Accepted  Funded  B Done  A Confirmed  Complete
         ▲
         Current Step
```

**EscrowCard Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 TRAFFIC_BUY                               [FUNDED] 🟢      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Amount: $100.00 USD                                           │
│                                                                 │
│  ┌────────────┐          →          ┌────────────┐             │
│  │  👤 John   │                     │  👤 Ore    │             │
│  │  Party A   │                     │  Party B   │             │
│  │  Requestor │                     │  Provider  │             │
│  └────────────┘                     └────────────┘             │
│                                                                 │
│  Created: Dec 18, 2025              Expires: Dec 25, 2025      │
│                                                                 │
│  [View Details →]                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Attachment Components

```
components/
├── attachments/
│   ├── AttachmentList.tsx      # List of attachments on escrow
│   ├── AttachmentCard.tsx      # Individual attachment display
│   ├── AttachmentUpload.tsx    # Drag-drop upload zone
│   ├── AttachmentPreview.tsx   # Preview (for images, PDFs)
│   └── AttachmentStatus.tsx    # Status badge (uploaded, escrowed, released)
```

**AttachmentCard Props:**
```typescript
interface AttachmentCardProps {
  id: string;
  filename: string;
  type: 'DOCUMENT' | 'IMAGE' | 'TEXT' | 'ARCHIVE' | 'LINK';
  sizeBytes: number;
  status: 'UPLOADED' | 'ESCROWED' | 'RELEASED';
  uploadedBy: 'party_a' | 'party_b';
  uploadedAt: string;
  canDownload: boolean;
  canRelease: boolean;
  onDownload?: () => void;
  onRelease?: () => void;
  onDelete?: () => void;
}
```

**AttachmentCard Visual:**
```
┌─────────────────────────────────────────────────────────────┐
│  📄 contract_signed.pdf                    [ESCROWED] 🔒    │
│  245 KB • Uploaded by Party A • Dec 18, 2025               │
│                                                             │
│  [🔒 Locked until conditions met]                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  📷 proof_of_delivery.png                  [RELEASED] ✅    │
│  1.2 MB • Uploaded by Party B • Dec 19, 2025               │
│                                                             │
│  [⬇️ Download]                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 Organization Components

```
components/
├── org/
│   ├── OrgSwitcher.tsx         # Dropdown to switch between orgs
│   ├── OrgCard.tsx             # Organization summary card
│   ├── OrgMemberList.tsx       # List of org members
│   ├── OrgMemberCard.tsx       # Individual member display
│   ├── OrgInviteModal.tsx      # Invite new member modal
│   ├── OrgSettings.tsx         # Organization settings form
│   └── OrgAccountSummary.tsx   # Organization account (same as user account)
```

**OrgSwitcher Visual (in Header):**
```
┌─────────────────────────────────────┐
│  🏢 MPC Holdings  ▼                 │
├─────────────────────────────────────┤
│  ✓ MPC Holdings                     │
│    Acme Corp                        │
│  ──────────────────────             │
│    👤 Personal Account              │
│  ──────────────────────             │
│    + Create Organization            │
└─────────────────────────────────────┘
```

**OrgMemberCard Props:**
```typescript
interface OrgMemberCardProps {
  userId: string;
  displayName: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: string;
  canManage: boolean; // Show edit/remove buttons
}
```

### 3.6 Service Type Components

```
components/
├── services/
│   ├── ServiceTypeCard.tsx     # Display a service type option
│   ├── TrafficBuyForm.tsx      # TRAFFIC_BUY specific form
│   ├── DocumentDeliveryForm.tsx # DOCUMENT_DELIVERY specific form
│   └── CustomEscrowForm.tsx    # Generic custom escrow form
```

**TrafficBuyForm Fields:**
```typescript
interface TrafficBuyFormData {
  validatorPartyId: string;      // Canton validator party ID
  amountUsd: number;             // Amount in USD to spend
  // Calculated fields (display only):
  estimatedTrafficMb: number;    // amountUsd / 60
  platformFee: number;           // amountUsd * 0.15
  totalCharge: number;           // amountUsd + platformFee
}
```

**TrafficBuyForm Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  BUY TRAFFIC FOR YOUR VALIDATOR                                 │
│                                                                 │
│  Validator Party ID *                                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ auth0_007c68d2894fe33775a90f6235ef::1220be1c48dd...   │    │
│  └────────────────────────────────────────────────────────┘    │
│  ⓘ Enter the party ID of the validator that needs traffic      │
│                                                                 │
│  Amount (USD) *                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ $                                              100.00  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Summary                                                 │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  Traffic you'll receive:     ~1.67 MB                   │   │
│  │  Platform fee (15%):         $15.00                     │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  Total charge:               $115.00                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CREATE ESCROW REQUEST  →                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.7 Provider Components

```
components/
├── provider/
│   ├── ProviderDashboard.tsx       # Overview for providers
│   ├── PendingRequestList.tsx      # Requests available to accept
│   ├── PendingRequestCard.tsx      # Individual request card
│   ├── AutoAcceptSettings.tsx      # Configure auto-accept rules
│   └── ExecuteActionButton.tsx     # Button to execute the service
```

### 3.8 Common/UI Components

```
components/
├── ui/
│   ├── Button.tsx              # (from shadcn/ui)
│   ├── Card.tsx                # (from shadcn/ui)
│   ├── Input.tsx               # (from shadcn/ui)
│   ├── Badge.tsx               # Status badges
│   ├── Avatar.tsx              # User/org avatars
│   ├── Modal.tsx               # Modal dialogs
│   ├── Tabs.tsx                # Tab navigation
│   ├── Table.tsx               # Data tables
│   ├── Skeleton.tsx            # Loading skeletons
│   ├── EmptyState.tsx          # Empty state illustrations
│   ├── ErrorState.tsx          # Error display
│   └── ConfirmDialog.tsx       # Confirmation dialogs
```

---

## 4. Page Layouts

### 4.1 Landing / Dashboard Page (`/`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo] Escrow Service          [🏢 MPC Holdings ▼]  [👤 John ▼]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  YOUR ACCOUNT                                      [+ Deposit]   │   │
│  │  $1,250.00 total   •   $750 available   •   $500 in contract    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  QUICK ACTIONS                                                   │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │   │
│  │  │ 🚀 Buy Traffic │  │ 📄 Send Doc    │  │ 🔑 API Key     │     │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ACTIVE ESCROWS                              [+ Create New]      │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  [EscrowCard 1]                                                 │   │
│  │  [EscrowCard 2]                                                 │   │
│  │  [EscrowCard 3]                                                 │   │
│  │                                                                  │   │
│  │  [Show All Escrows →]                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  RECENT TRANSACTIONS                                             │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  [LedgerTable - last 5 entries]                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Create Escrow Page (`/escrow/new`)

Multi-step form:
1. Select Service Type
2. Enter Details (form varies by type)
3. Review & Confirm
4. Payment (redirect to Stripe or use balance)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo] Escrow Service                              [🏢 ▼]  [👤 ▼]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ← Back                                                                 │
│                                                                         │
│  CREATE NEW ESCROW                                                      │
│                                                                         │
│  ○ Select Type ─── ● Enter Details ─── ○ Review ─── ○ Pay              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  [TrafficBuyForm / DocumentDeliveryForm / etc.]                 │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────┐         ┌────────────────────────────────┐     │
│  │  ← Previous        │         │             Next Step →         │     │
│  └────────────────────┘         └────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Escrow Detail Page (`/escrow/[id]`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo] Escrow Service                              [🏢 ▼]  [👤 ▼]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ← Back to Dashboard                                                    │
│                                                                         │
│  ESCROW #abc123                                      [FUNDED] 🟢        │
│  Traffic Purchase                                                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TIMELINE                                                        │   │
│  │  ●─────●─────●─────○─────○─────○                                │   │
│  │  Created  Accepted  Funded  Executing  Confirmed  Complete       │   │
│  │           Dec 18    Dec 18  ← Current                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐   │
│  │  PARTY A (Requestor)         │  │  PARTY B (Provider)          │   │
│  │  👤 John Doe                 │  │  👤 Ore (MPC Holdings)       │   │
│  │  john@example.com            │  │  ore@mpch.io                 │   │
│  │  ✅ Funded                   │  │  ⏳ Awaiting execution       │   │
│  └──────────────────────────────┘  └──────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  DETAILS                                                         │   │
│  │  Amount:           $100.00 USD                                  │   │
│  │  Platform Fee:     $15.00                                       │   │
│  │  Traffic:          ~1.67 MB                                     │   │
│  │  Validator:        auth0_007c68d2894fe33775a90f6235ef::...      │   │
│  │  Created:          Dec 18, 2025 10:30 AM                        │   │
│  │  Expires:          Dec 25, 2025 10:30 AM                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ATTACHMENTS                                      [+ Upload]     │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  📄 receipt.pdf          [RELEASED] ✅         [⬇️ Download]    │   │
│  │  No other attachments                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ACTIONS                                                         │   │
│  │  [✅ Confirm I Received Traffic]      [❌ Raise Dispute]        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  EVENT LOG                                                       │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  Dec 18, 10:35 AM   Escrow funded by John                       │   │
│  │  Dec 18, 10:32 AM   Accepted by Ore (auto-accept)               │   │
│  │  Dec 18, 10:30 AM   Escrow created by John                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Account Page (`/account`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo] Escrow Service                              [🏢 ▼]  [👤 ▼]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  MY ACCOUNT                                                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [AccountSummary - full version with visual chart]              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TRANSACTION HISTORY                            [Export CSV]     │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  Date         Type              Amount      Balance    Ref      │   │
│  │  ────────────────────────────────────────────────────────────   │   │
│  │  Dec 18       DEPOSIT           +$500.00    $1,250.00  stripe.. │   │
│  │  Dec 17       ESCROW_RELEASE    -$100.00    $750.00    esc_123  │   │
│  │  Dec 17       ESCROW_LOCK       -$100.00    $850.00    esc_123  │   │
│  │  Dec 15       DEPOSIT           +$750.00    $950.00    stripe.. │   │
│  │  Dec 14       ESCROW_RECEIVE    +$85.00     $200.00    esc_099  │   │
│  │                                                                  │   │
│  │  [Load More]                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. State Management

Use React Context or Zustand for:

### 5.1 User Context
```typescript
interface UserContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentOrg: Organization | null;
  organizations: Organization[];
  setCurrentOrg: (org: Organization | null) => void;
}
```

### 5.2 Account Context
```typescript
interface AccountContext {
  personalAccount: Account | null;
  orgAccount: Account | null;  // Current org's account
  activeAccount: Account | null;  // Which one is being used
  isLoading: boolean;
  refetch: () => void;
}

interface Account {
  id: string;
  ownerId: string;  // user_id or org_id
  ownerType: 'user' | 'organization';
  totalBalance: number;
  availableBalance: number;
  inContractBalance: number;
  currency: string;
}
```

---

## 6. Mock Data

Create mock data files for development. Backend will replace these later.

```
lib/
├── mock/
│   ├── users.ts
│   ├── organizations.ts
│   ├── accounts.ts
│   ├── escrows.ts
│   ├── attachments.ts
│   └── ledgerEntries.ts
```

Example mock:
```typescript
// lib/mock/escrows.ts
export const mockEscrows: Escrow[] = [
  {
    id: 'esc_001',
    serviceType: 'TRAFFIC_BUY',
    status: 'FUNDED',
    amount: 100.00,
    currency: 'USD',
    partyA: { id: 'user_1', name: 'John Doe', email: 'john@example.com' },
    partyB: { id: 'user_2', name: 'Ore', email: 'ore@mpch.io' },
    metadata: {
      validatorPartyId: 'auth0_007c68d2894fe33775a90f6235ef::...',
      trafficBytes: 1666666,
    },
    createdAt: '2025-12-18T10:30:00Z',
    expiresAt: '2025-12-25T10:30:00Z',
  },
  // ... more mock data
];
```

---

## 7. API Hooks (Placeholder)

Create hooks that will be connected to the backend later:

```typescript
// hooks/useAccount.ts
export function useAccount() {
  // For now, return mock data
  // Backend integration will replace this
  return {
    account: mockAccount,
    isLoading: false,
    error: null,
    refetch: () => {},
  };
}

// hooks/useEscrows.ts
export function useEscrows() {
  return {
    escrows: mockEscrows,
    isLoading: false,
    error: null,
  };
}

// hooks/useOrganizations.ts
export function useOrganizations() {
  return {
    organizations: mockOrganizations,
    currentOrg: mockOrganizations[0],
    setCurrentOrg: (org) => {},
  };
}
```

---

## 8. Color Scheme & Status Colors

### Status Colors
```css
--status-created: #6B7280;      /* Gray */
--status-pending: #F59E0B;      /* Amber */
--status-funded: #3B82F6;       /* Blue */
--status-confirmed: #8B5CF6;    /* Purple */
--status-completed: #10B981;    /* Green */
--status-canceled: #EF4444;     /* Red */
--status-disputed: #F97316;     /* Orange */
```

### Account Colors
```css
--balance-available: #10B981;   /* Green */
--balance-locked: #6366F1;      /* Indigo */
--balance-total: #1F2937;       /* Dark gray */
```

---

## 9. Responsive Breakpoints

```css
/* Mobile first */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
```

---

## 10. Key Interactions

### 10.1 Create Escrow Flow
1. Click "+ Create New" → Navigate to `/escrow/new`
2. Select service type (cards)
3. Fill in form (varies by type)
4. Review summary
5. Choose payment method (balance or Stripe)
6. Confirm → Show success, redirect to escrow detail

### 10.2 Confirm Escrow Flow
1. On escrow detail page, click "Confirm I Received"
2. Show confirmation dialog: "Are you sure?"
3. On confirm → Update status, show success toast
4. If both parties confirmed → Show "Completed" celebration

### 10.3 Upload Attachment Flow
1. Click "+ Upload" on escrow detail
2. Drag-drop zone appears
3. Select file(s)
4. Show upload progress
5. On complete → File appears in list with "UPLOADED" status
6. Can "Release" to other party when ready

---

## 11. File Structure

```
app/
├── layout.tsx
├── page.tsx                    # Dashboard
├── account/
│   └── page.tsx
├── escrow/
│   ├── new/
│   │   └── page.tsx
│   └── [id]/
│       └── page.tsx
├── org/
│   └── [orgId]/
│       ├── page.tsx
│       ├── members/
│       │   └── page.tsx
│       └── account/
│           └── page.tsx
├── provider/
│   └── page.tsx
└── settings/
    └── page.tsx

components/
├── layout/
├── account/
├── escrow/
├── attachments/
├── org/
├── services/
├── provider/
└── ui/

lib/
├── mock/
├── utils/
└── types/

hooks/
├── useAccount.ts
├── useEscrows.ts
├── useOrganizations.ts
└── useAttachments.ts
```

---

## 12. Deliverables

Please provide:

1. **All pages** listed in Section 2
2. **All components** listed in Section 3
3. **Mock data** files for development
4. **Placeholder hooks** for API integration
5. **Responsive design** for mobile + desktop
6. **Loading states** (skeletons)
7. **Empty states** (no escrows, no transactions, etc.)
8. **Error states** (network error, not found, etc.)

**Do NOT implement:**
- Actual API calls (use mock data)
- Authentication flow (assume user is logged in)
- Stripe integration (just show "Pay with Stripe" button)
- Real file upload (just show the UI)

Backend integration will be done separately after receiving your code.

---

*End of Frontend Specification*
