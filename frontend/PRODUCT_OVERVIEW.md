# EscrowService - Product Overview

## What is EscrowService?

EscrowService is a secure digital escrow platform that enables trusted transactions between parties. It holds funds in a neutral account until predetermined conditions are met, protecting both buyers and sellers in any transaction.

---

## Core Value Proposition

**Problem**: In digital transactions, trust is a major barrier. Buyers fear paying without receiving goods/services. Sellers fear delivering without receiving payment.

**Solution**: EscrowService acts as a trusted third party, holding funds securely until both parties confirm the transaction terms are met.

---

# CURRENT FEATURES (v1.0)

## 1. Two-Party Escrow

### Create Escrows
- Define terms, amount, and description
- Select service type (categorizes the transaction)
- Set counterparty assignment method
- Choose arbiter for dispute resolution
- Optional expiration date

### Fund Escrows
- Secure payment via Stripe integration
- Credit card and bank payment support
- Funds held in platform account until release

### Track Progress
- Real-time status updates
- Event history for each escrow
- Attachment support for documentation

### Complete or Cancel
- Release funds to provider on completion
- Refund to creator on cancellation (before funding only)
- Automatic refund on expiration

---

## 2. Obligation Tracking

**What It Does:** Automatically tracks what each party needs to do and shows real-time completion status.

### How It Works
- Obligations auto-generate from the service type when escrow is created
- Party A's obligation auto-completes when they fund the escrow
- Party B's obligation auto-completes when Party A confirms delivery
- Zero extra clicks required from users

### Visual Display
```
┌─────────────────────────────────────────────────┐
│  Obligations                                    │
├─────────────────────────────────────────────────┤
│  ✅ PARTY A (ORIGINATOR)           [Complete]   │
│     Payment: USD 500.00                         │
│     Completed: Dec 19, 2025 at 10:30 AM         │
├─────────────────────────────────────────────────┤
│  ⏳ PARTY B (COUNTERPARTY)         [Pending]    │
│     Traffic Delivery (bytes)                    │
└─────────────────────────────────────────────────┘
```

### Benefits
- Clear expectations for both parties
- Proof of completion with timestamps
- Link evidence/attachments to specific obligations

---

## 3. Custom Arbiter for Dispute Resolution

**What It Does:** Choose who resolves disputes if something goes wrong.

### Arbiter Options
| Option | Description |
|--------|-------------|
| **Platform Only** | Platform administrators handle disputes (default, recommended) |
| **Platform AI** | AI-powered dispute resolution (coming soon) |
| **Third-Party Organization** | Any admin from a specified organization can arbitrate |
| **Specific Person** | A designated person (by email) serves as arbiter |

### Arbiter Powers
- **Cancel & Refund** - Return funds to Party A (with documented reason)
- **Force Release** - Send funds to Party B (with documented reason)
- Platform always retains override capability regardless of custom arbiter

### Use Cases
- Industry-specific expertise needed for disputes
- Trusted mutual contact agreed upon by both parties
- Organization-level accountability preferred

---

## 4. Evidence & Attachments

**What It Does:** Attach files as proof of work, delivery, or general documentation.

### Attachment Categories (Purpose)
| Purpose | Description |
|---------|-------------|
| **Evidence (Party A)** | Proof that Party A fulfilled their part |
| **Evidence (Party B)** | Proof that Party B fulfilled their part |
| **Deliverable (Party A)** | The actual item Party A is delivering |
| **Deliverable (Party B)** | The actual item Party B is delivering |
| **General** | Notes, context, or supplementary documents |

### Supported Files
- Documents (PDF, DOC, TXT)
- Images (PNG, JPG)
- Data files (CSV, JSON)

---

## 4.5. Confirmation Forms with Attachments (NEW - Dec 21, 2025)

**What It Does:** Modal forms for Fund and Confirm actions with notes, file upload, and escrow-until-completion option.

### The Feature
When clicking **Fund** or **Confirm** buttons on deal cards, a modal opens with:
- **Notes Field**: Add any relevant information about the action
- **File Upload**: Attach files (documents, images, data)
- **Hold Until Completion**: Checkbox to escrow attachment until both parties confirm

### Escrowed Attachments
```
Party A uploads document with "Hold until completion" checked
  → Document is ESCROWED (neither party can see it)
  → Party B confirms delivery
  → Party A confirms receipt
  → Document RELEASED to both parties
```

### $0 Document Deals
This enables pure document exchange without monetary value:
- Create a $0 deal
- Both parties upload their documents with "hold until completion"
- Once both confirm, documents are released to each party
- No money changes hands, just secure document exchange

### Confirmation Steps
| Step | Who Does It | Description |
|------|-------------|-------------|
| **Funding** | Party A | Fund the deal with optional notes/attachment |
| **Party B Confirm** | Party B | Confirm delivery with evidence |
| **Party A Confirm** | Party A | Confirm receipt and release funds |

---

## 5. Escrow Security

**Critical Protection:** Prevents the "do work then cancel" attack.

### The Problem This Solves
```
Without protection:
1. Party A funds escrow
2. Party B performs irreversible work
3. Party A cancels → gets refund
4. Party B loses work AND payment
```

### Security Rule
Once an escrow is FUNDED, neither party can cancel unilaterally. Only the designated arbiter (or platform admin) can intervene through dispute resolution.

### Cancellation Rules (Updated Dec 21, 2025)
| Escrow Status | Party A Can Cancel? | Party B Can Cancel? | Arbiter Can Intervene? |
|---------------|---------------------|---------------------|------------------------|
| PENDING | ✅ Yes | N/A (not assigned) | ✅ Yes |
| PENDING_ACCEPTANCE | ❌ No | ❌ No | ✅ Yes |
| PENDING_FUNDING | ❌ No | ❌ No | ✅ Yes |
| FUNDED | ❌ No | ❌ No | ✅ Yes |
| PARTY_B_CONFIRMED | ❌ No | ❌ No | ✅ Yes |
| PARTY_A_CONFIRMED | ❌ No | ❌ No | ✅ Yes |
| COMPLETED | ❌ No | ❌ No | ❌ No |

**Key Change (Dec 21):** Only the originator (Party A) can cancel, and only before the counterparty accepts. Once accepted, neither party can cancel - only the designated arbiter can intervene.

---

## 5.5. Canton Blockchain Tokenization (NEW - Dec 23, 2025)

**What It Does:** Register escrows as immutable on-chain assets on the Canton blockchain via theRegistry.

### The Feature
- Organizations can enable the "Tokenization" feature flag
- Eligible escrows show a "Tokenize" button
- Tokenized escrows display a cyan "Tokenized" badge on deal cards
- Creates an immutable on-chain record with full escrow metadata

### How It Works
```
1. Click "Tokenize" on an eligible escrow
2. Escrow data is sent to theRegistry API
3. theRegistry registers it on Canton blockchain
4. Contract ID is assigned (async - may take a moment)
5. Badge shows "Tokenized" on the deal card
```

### Status Tracking
The tokenization modal shows three status values:
| Status | Values | Meaning |
|--------|--------|---------|
| **Sync Status** | pending, synced, failed | Has theRegistry synced with Canton? |
| **On-Chain Status** | unchecked, local-only, onchain | Is it actually on the blockchain? |
| **Found on Chain** | Yes, No | Did Canton confirm the contract exists? |

### Actions Available
| Button | When Shown | What It Does |
|--------|------------|--------------|
| **Tokenize** | Not yet tokenized | Register escrow on blockchain |
| **Check Blockchain** | Always (when tokenized) | Sync status from Canton |
| **Push to Blockchain** | When "local-only" | Re-push failed registrations |
| **Update Metadata** | When tokenized | Update on-chain metadata (archives old contract) |

### Configuration Required
- **Platform Level**: theRegistry API URL (Admin → Platform Settings)
- **Organization Level**: API Key + Wallet Address (Org → Feature Flags → Tokenization)

---

## 6. Counterparty Assignment

Three methods to assign the other party:

| Method | Description | Use Case |
|--------|-------------|----------|
| **Open** | Anyone on platform can accept | Marketplace-style, first-come |
| **Organization** | Assign to org by ID (any member can accept) | B2B transactions |
| **Person** | Assign to specific email | Direct person-to-person |

### Privacy Feature
Instead of showing organization names in a dropdown (which reveals who uses the platform), users paste Organization IDs directly. Find your Org ID on the Balances page with a copy button.

---

## 7. Privacy Levels

Control what information is visible on the escrow:

| Level | Counterparty Sees |
|-------|-------------------|
| **Full Details** | Your name, organization, all escrow details |
| **Limited** | Organization name only, no personal details |
| **Anonymous** | Only escrow terms visible until accepted |

---

## 8. Organization Support

### Organization Management
- Create organizations (business entities)
- Unique Organization ID for private sharing
- Separate financial accounts per org

### Member Management
- Add members by email
- Assign roles: Admin or Member
- Remove members with confirmation
- Delete organizations (with safety checks)

### Visibility
- Members see escrows assigned to their org
- Admins can manage all org settings
- Organization ID not publicly exposed

---

## 9. Financial Management

### Account Balances
- **Available Balance**: Funds ready to use
- **In-Escrow Balance**: Funds locked in active escrows
- **Total Balance**: Sum of all funds

### Transactions
- Deposit funds via Stripe or Canton Wallet
- View complete ledger history
- Track all money movements

### Payments
- Stripe checkout integration (credit/debit cards)
- Canton Wallet funding via Loop SDK (see section 9.5)
- Webhook handling for payment confirmation
- Success/cancel redirect flows

---

## 9.5. Canton Wallet Funding (NEW - Dec 27, 2025)

**What It Does:** Fund your escrow account using Canton Coin (CC) from your Canton blockchain wallet via the Loop SDK.

### The Feature
- Native blockchain payment option alongside traditional credit cards
- Real-time CC/USD exchange rate from Kaiko API
- Wallet connection remembered for returning users
- Full transaction audit trail with Canton TX IDs

### How It Works
```
1. Select "Canton Wallet" funding option
2. Connect your Loop wallet (OAuth popup)
3. Enter USD amount → see CC equivalent
4. Review exchange rate and confirm
5. Approve transfer in your wallet
6. Account credited instantly
```

### Funding Modal Steps
| Step | Description |
|------|-------------|
| **Connect** | OAuth popup to connect Loop wallet |
| **Amount** | Enter USD, see CC equivalent with live rate |
| **Confirm** | Review transfer details before sending |
| **Processing** | Wallet confirmation & blockchain transfer |
| **Success** | Account credited, Canton TX ID displayed |

### Exchange Rate
- Real-time CC/USD price from Kaiko API
- Refresh button to get latest rate before confirming
- Rate locked at time of session creation

### Configuration Required
| Setting | Description |
|---------|-------------|
| `LOOP_PLATFORM_PARTY_ID` | Platform wallet receiving CC payments |
| `LOOP_NETWORK` | Network (mainnet or testnet) |
| `KAIKO_API_KEY` | API key for CC/USD price feed |

### Why Canton Wallet?
- **No Credit Card Fees**: Direct blockchain transfer
- **Instant Settlement**: No payment processor delays
- **Native Integration**: Use your existing Canton wallet
- **Audit Trail**: Immutable Canton transaction records

---

## 10. Dashboard

### Pending Actions Banner
- Prominent amber notification for escrows needing your action
- Count breakdown: assigned to you, your organization, open
- One-click "Review Now" button

### Escrow Filter Tabs
| Tab | Shows |
|-----|-------|
| All | Every escrow you can see |
| My Escrows | Where you are Party A or B |
| Organization | Assigned to your organization |

### Statistics
- Total escrows count
- Active escrows count
- Completed value
- Pending value

### Action Buttons on Deal Cards (NEW - Dec 21, 2025)
Dynamic action buttons appear on deal cards based on escrow status and user role:

| Action | When Shown | Button Style |
|--------|------------|--------------|
| **Accept** | PENDING + user is assigned or open offer | Green |
| **Fund** | PENDING_FUNDING + user is Party A | Amber |
| **Confirm** | FUNDED + user is Party B, or PARTY_B_CONFIRMED + user is Party A | Blue |
| **Cancel** | PENDING + user is Party A (originator) | Red outline |

---

## 11. Service Types

Pre-configured escrow templates for common transaction types:

| Service | Party A Delivers | Party B Delivers |
|---------|------------------|------------------|
| Traffic Purchase | USD Payment | Traffic (bytes) |
| Freelance Work | USD Payment | Completed Work |
| Digital Asset Sale | USD Payment | Digital Asset |
| Physical Goods | USD Payment | Shipped Goods |

Custom service types can be created by platform administrators with custom obligation definitions.

---

## 12. Admin Panel

Platform administration capabilities:

- **View All Escrows** - Monitor platform activity
- **Dispute Resolution** - Cancel or force-complete any escrow with reason
- **Organization Management** - Create, view, delete organizations
- **Member Management** - Add/remove org members, change roles
- **User Management** - View and manage user accounts
- **Platform Settings** - Configure platform-wide settings

---

## Escrow Lifecycle

```
┌─────────────────────┐
│  PENDING_ACCEPTANCE │  Escrow created, awaiting counterparty
└─────────┬───────────┘
          │ counterparty accepts
          ▼
┌─────────────────────┐
│   PENDING_FUNDING   │  Terms agreed, awaiting Party A funds
└─────────┬───────────┘
          │ Party A funds escrow
          ▼
┌─────────────────────┐
│       FUNDED        │  Money held, Party B performs work
└─────────┬───────────┘  (Neither party can cancel)
          │
          ├──────────────────────┬──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────────┐  ┌──────────────────┐  ┌───────────────┐
│     COMPLETED       │  │ ADMIN_CANCELED   │  │   EXPIRED     │
│  Funds → Party B    │  │  Funds → Party A │  │ Funds → A     │
└─────────────────────┘  │  (dispute only)  │  └───────────────┘
                         └──────────────────┘
```

---

## User Roles

| Role | Capabilities |
|------|--------------|
| **Platform Admin** | Manage all orgs, platform settings, admin panel access, dispute resolution |
| **Custom Arbiter** | Resolve disputes for assigned escrows (cancel/force-complete) |
| **Organization Admin** | Manage org members, view all org escrows, invite users |
| **Organization Member** | Accept escrows for org, create personal escrows |
| **Individual User** | Create/manage personal escrows, fund via Stripe |

---

# FUTURE FEATURES (Planned)

## 1. Platform AI Arbiter

AI-powered dispute resolution:
- Automated verification based on rules
- Evidence analysis
- Suggested resolutions
- Currently shows "Coming Soon" badge in UI

---

## 2. Document Exchange Escrows (Non-Monetary)

Escrows where parties exchange documents/files instead of (or in addition to) money:

```
Party A: "I'll give you the deed to my property (PDF)"
Party B: "I'll give you my artwork files (ZIP)"

Neither party trusts the other to deliver after receiving.
Solution: Both upload to escrow, platform releases to both simultaneously.
```

### Key Features Required
- Per-Party Deliverables tracking
- Held State (files locked until release)
- Simultaneous Release to both parties

---

## 3. Milestone-Based Escrows

Break large escrows into phases with partial releases:

```
Total: $10,000

Milestone 1: Design mockups     → $2,000 (20%)
Milestone 2: Development        → $5,000 (50%)
Milestone 3: Testing & Launch   → $3,000 (30%)
```

Each milestone can be approved/rejected independently with partial fund releases.

---

## 4. Email Notifications

Automated emails for:
- Escrow created (to counterparty)
- Escrow accepted
- Escrow funded
- Action required reminders
- Completion/cancellation confirmation

---

## 5. API for Third-Party Integration

RESTful API for external systems:
- Create escrows programmatically
- Webhook notifications for status changes
- White-label embedding options

---

## 6. Multi-Currency & Crypto Support

- Multiple fiat currencies (USD, EUR, GBP)
- Cryptocurrency payments (BTC, ETH, stablecoins)
- Canton Network token integration

---

## Roadmap Summary

| Phase | Features | Status |
|-------|----------|--------|
| **Phase 1** | Core escrow, orgs, Stripe, dashboard | ✅ Complete |
| **Phase 1.5** | Obligation tracking, custom arbiter, evidence categorization, escrow security | ✅ Complete |
| **Phase 1.6** | Confirmation forms with attachments, action buttons, $0 document deals, cancellation refinements | ✅ Complete (Dec 21) |
| **Phase 1.7** | Canton blockchain tokenization (theRegistry), per-org feature flags | ✅ Complete (Dec 23) |
| **Phase 1.8** | Canton Loop SDK wallet funding, CC/USD exchange rates | ✅ Complete (Dec 27) |
| **Phase 2** | Email notifications, Platform AI arbiter | Planned |
| **Phase 3** | Document exchange escrows, milestone-based | Planned |
| **Phase 4** | AI agents, API, multi-currency | Future |

---

## Technical Stack

### Frontend
- React 19 with TypeScript
- Vite 7 build tool
- Tailwind CSS 4 + shadcn/ui components
- TanStack React Query for server state
- Wouter for routing

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL database (JSONB for flexibility)
- Stripe payment integration
- Session-based authentication

### Infrastructure
- SSH SOCKS5 proxy support (for IP-whitelisted APIs)
- Canton Network integration (theRegistry tokenization + Loop SDK funding)
- Railway PostgreSQL hosting
- Kaiko API for CC/USD exchange rates

---

## Contact & Support

For development questions, see `DEVELOPMENT_LOG.md` in this directory.

---

*Last Updated: December 27, 2025*
