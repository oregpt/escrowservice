// ============================================
// ESCROW SERVICE - TYPE DEFINITIONS
// ============================================

// Organization
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  settings: Record<string, any>;
  billingEmail?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User Roles
export type UserRole = 'user' | 'provider' | 'admin' | 'platform_admin';

// User
export interface User {
  id: string;
  externalId?: string;
  email?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  isAuthenticated: boolean;
  isProvider: boolean;
  sessionId?: string;
  primaryOrgId?: string;            // Every user belongs to an org
  createdAt: Date;
  updatedAt: Date;
}

// User with password (internal use only, never expose to API)
export interface UserWithPassword extends User {
  passwordHash?: string;
}

// Organization Member
export type OrgRole = 'admin' | 'member' | 'viewer';

export interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  canUseOrgAccount: boolean;
  canCreateEscrows: boolean;
  canManageMembers: boolean;
  joinedAt: Date;
}

// Account (was Wallet)
export interface Account {
  id: string;
  userId?: string;
  organizationId?: string;
  availableBalance: number;
  inContractBalance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountWithTotals extends Account {
  totalBalance: number;
  ownerType: 'user' | 'organization';
}

// Ledger Entry
export type LedgerEntryType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'ESCROW_LOCK'
  | 'ESCROW_RELEASE'
  | 'ESCROW_RECEIVE'
  | 'PLATFORM_FEE'
  | 'REFUND';

export type LedgerBucket = 'available' | 'in_contract';

export interface LedgerEntry {
  id: string;
  accountId: string;
  amount: number;
  bucket: LedgerBucket;
  entryType: LedgerEntryType;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: Date;
}

// Service Types
export type ServiceTypeId = 'TRAFFIC_BUY' | 'DOCUMENT_DELIVERY' | 'API_KEY_EXCHANGE' | 'CUSTOM';

export interface ServiceType {
  id: ServiceTypeId;
  name: string;
  description?: string;
  partyADelivers: {
    type: string;
    label: string;
  };
  partyBDelivers: {
    type: string;
    label: string;
  };
  platformFeePercent: number;
  autoAcceptable: boolean;
  requiresPartyAConfirmation: boolean;
  requiresPartyBConfirmation: boolean;
  metadataSchema?: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
}

// Privacy Levels
export type PrivacyLevel = 'public' | 'platform' | 'private';

// Arbiter Types (who can resolve disputes)
export type ArbiterType = 'platform_only' | 'platform_ai' | 'organization' | 'person';

// Obligation Tracking
// Each escrow has obligations for Party A and Party B that are auto-generated from service type
export type ObligationStatus = 'pending' | 'completed' | 'disputed';
export type ObligationParty = 'A' | 'B';

export interface Obligation {
  id: string;                          // e.g., 'obl_a' or 'obl_b'
  party: ObligationParty;              // Which party owns this obligation
  description: string;                 // Human-readable (e.g., "Pay $500.00")
  type: string;                        // From service_type (e.g., "FIAT_USD", "CANTON_TRAFFIC")
  status: ObligationStatus;
  completedAt?: string;                // ISO timestamp when completed
  evidenceAttachmentIds?: string[];    // Attachments proving completion
}

// Escrow
export type EscrowStatus =
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

export interface Escrow {
  id: string;
  serviceTypeId: ServiceTypeId;
  // Organization-based ownership (new model)
  partyAOrgId: string;              // Organization creating the escrow (required)
  createdByUserId: string;          // User who created it (for audit)
  partyBOrgId?: string;             // Counterparty org (if assigned to org)
  partyBUserId?: string;            // Counterparty user (if assigned to specific user)
  acceptedByUserId?: string;        // User who accepted (for audit)
  // Legacy fields (kept for backwards compatibility)
  partyAUserId?: string;            // @deprecated - use createdByUserId
  // Counterparty details (for invites before they accept)
  isOpen: boolean;
  counterpartyName?: string;
  counterpartyEmail?: string;
  // Privacy level
  privacyLevel: PrivacyLevel;
  // Arbiter (dispute resolution - platform always has override)
  arbiterType: ArbiterType;         // Who can resolve disputes
  arbiterOrgId?: string;            // If arbiter is an organization
  arbiterUserId?: string;           // If arbiter is a specific user
  arbiterEmail?: string;            // Email for arbiter invite (before they register)
  // Status and amounts
  status: EscrowStatus;
  amount: number;
  currency: string;
  platformFee: number;
  // Terms
  title?: string;
  description?: string;
  terms?: string;
  // Service-specific data
  metadata?: Record<string, any>;
  // Timestamps
  partyAConfirmedAt?: Date;
  partyBConfirmedAt?: Date;
  fundedAt?: Date;
  completedAt?: Date;
  canceledAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscrowWithParties extends Escrow {
  partyAOrg: Organization;          // The organization that created the escrow
  createdBy: User;                  // User who created it
  partyBOrg?: Organization;         // Counterparty org (if assigned to org)
  partyB?: User;                    // Counterparty user (if assigned to specific user)
  acceptedBy?: User;                // User who accepted
  serviceType: ServiceType;
  attachments: Attachment[];
  // Arbiter details (populated)
  arbiterOrg?: Organization;        // If arbiter is an organization
  arbiter?: User;                   // If arbiter is a specific user
  // Legacy - kept for backwards compatibility
  partyA?: User;                    // @deprecated
}

// Escrow Events
export type EscrowEventType =
  | 'CREATED'
  | 'ACCEPTED'
  | 'FUNDED'
  | 'PARTY_B_CONFIRMED'
  | 'PARTY_A_CONFIRMED'
  | 'COMPLETED'
  | 'CANCELED'
  | 'ADMIN_CANCELED'    // Platform admin canceled (dispute resolution)
  | 'ADMIN_COMPLETED'   // Platform admin force completed (dispute resolution)
  | 'DISPUTED'
  | 'ATTACHMENT_UPLOADED'
  | 'ATTACHMENT_RELEASED'
  | 'MESSAGE_ADDED';

export interface EscrowEvent {
  id: string;
  escrowId: string;
  eventType: EscrowEventType;
  actorUserId?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

// Escrow Messages (notes/communication between parties)
export interface EscrowMessage {
  id: string;
  escrowId: string;
  userId: string;
  message: string;
  isSystemMessage: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  // Populated fields
  user?: {
    id: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
  };
}

// Provider Settings
export interface ProviderSettings {
  id: string;
  userId: string;
  serviceTypeId: ServiceTypeId;
  autoAcceptEnabled: boolean;
  maxAmount?: number;
  minAmount?: number;
  capabilities?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Stripe Payments
export type StripePaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export interface StripePayment {
  id: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  userId: string;
  escrowId?: string;
  amount: number;
  currency: string;
  status: StripePaymentStatus;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Canton Traffic Requests
export interface CantonTrafficRequest {
  id: string;
  escrowId: string;
  receivingValidatorPartyId: string;
  domainId: string;
  trafficAmountBytes: number;
  trackingId: string;
  cantonResponse?: Record<string, any>;
  executedAt?: Date;
  createdAt: Date;
}

// Attachments
export type AttachmentType = 'DOCUMENT' | 'IMAGE' | 'TEXT' | 'ARCHIVE' | 'LINK';
export type AttachmentStatus = 'UPLOADED' | 'ESCROWED' | 'RELEASED' | 'DELETED';

// Purpose categorizes what this attachment is for
export type AttachmentPurpose =
  | 'evidence_a'      // Party A proving they did their part
  | 'evidence_b'      // Party B proving they did their part
  | 'deliverable_a'   // The actual item Party A is delivering (e.g., payment receipt)
  | 'deliverable_b'   // The actual item Party B is delivering (e.g., document, API key)
  | 'general';        // General attachment (notes, context, etc.)

export interface Attachment {
  id: string;
  escrowId: string;
  uploadedByUserId: string;
  attachmentType: AttachmentType;
  purpose?: AttachmentPurpose;       // What this attachment is proving or delivering
  filename: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
  storageProvider: 'local' | 's3' | 'r2';
  checksumSha256?: string;
  encryptionKeyId?: string;
  status: AttachmentStatus;
  releasedToUserId?: string;
  releasedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Tokenization Records (on-chain contract history)
export interface TokenizationRecord {
  id: string;
  escrowId: string;
  // On-chain identifiers
  contractId: string;
  updateId?: string;
  offset?: number;
  // Tokenization platform identifiers
  tokenId?: string;
  tokenizationPlatform?: string;
  // Additional data
  metadata?: Record<string, any>;
  escrowStatus?: EscrowStatus;
  createdAt: Date;
}

// API Request/Response Types
export interface CreateEscrowRequest {
  serviceTypeId: ServiceTypeId;
  amount: number;
  currency?: string;
  // Counterparty - one of: open, org, or specific user
  isOpen?: boolean;                   // Anyone can accept
  counterpartyOrgId?: string;         // Assign to entire org (any member can accept)
  counterpartyUserId?: string;        // Assign to specific user
  counterpartyName?: string;          // Display name for invites
  counterpartyEmail?: string;         // Email for invites
  // Privacy
  privacyLevel?: PrivacyLevel;
  // Arbiter (dispute resolution)
  arbiterType?: ArbiterType;          // 'platform_only' (default), 'organization', 'person'
  arbiterOrgId?: string;              // If arbiter is an organization
  arbiterEmail?: string;              // If arbiter is a specific person (email)
  // Terms
  title?: string;
  description?: string;
  terms?: string;
  // Service-specific data
  metadata?: Record<string, any>;
  expiresInDays?: number;
}

export interface CreateOrgRequest {
  name: string;
  slug?: string;
  billingEmail?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: OrgRole;
}

// Traffic Buy specific
export interface TrafficBuyMetadata {
  validatorPartyId: string;
  trafficAmountBytes: number;
  domainId: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth Request Types
export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ConvertAccountRequest {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

// Admin Stats
export interface PlatformStats {
  users: {
    total: number;
    authenticated: number;
    anonymous: number;
    providers: number;
    admins: number;
  };
  organizations: {
    total: number;
    active: number;
  };
  escrows: {
    total: number;
    active: number;
    completed: number;
    canceled: number;
    totalVolume: number;
    totalFees: number;
  };
  accounts: {
    totalBalance: number;
    inContract: number;
    available: number;
  };
}
