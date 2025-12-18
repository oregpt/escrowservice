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

// User
export interface User {
  id: string;
  externalId?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  isAuthenticated: boolean;
  isProvider: boolean;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
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
  partyAUserId: string;
  partyBUserId?: string;
  status: EscrowStatus;
  amount: number;
  currency: string;
  platformFee: number;
  metadata?: Record<string, any>;
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
  partyA: User;
  partyB?: User;
  serviceType: ServiceType;
  attachments: Attachment[];
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
  | 'DISPUTED'
  | 'ATTACHMENT_UPLOADED'
  | 'ATTACHMENT_RELEASED';

export interface EscrowEvent {
  id: string;
  escrowId: string;
  eventType: EscrowEventType;
  actorUserId?: string;
  details?: Record<string, any>;
  createdAt: Date;
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

export interface Attachment {
  id: string;
  escrowId: string;
  uploadedByUserId: string;
  attachmentType: AttachmentType;
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

// API Request/Response Types
export interface CreateEscrowRequest {
  serviceTypeId: ServiceTypeId;
  amount: number;
  currency?: string;
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
