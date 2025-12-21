// API Client for Escrow Service Backend

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Session management
let sessionId: string | null = localStorage.getItem('escrow_session_id');

export function getSessionId(): string | null {
  return sessionId;
}

export function setSessionId(id: string): void {
  sessionId = id;
  localStorage.setItem('escrow_session_id', id);
}

export function clearSession(): void {
  sessionId = null;
  localStorage.removeItem('escrow_session_id');
}

// API Response type
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Generic fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (sessionId) {
    (headers as Record<string, string>)['X-Session-ID'] = sessionId;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ===== AUTH =====
export const auth = {
  getMe: () => apiFetch<{ user: User | null; authenticated: boolean }>('/auth/me'),

  createSession: () => apiFetch<{ user: User; sessionId: string }>('/auth/session', {
    method: 'POST',
    body: JSON.stringify({ sessionId: crypto.randomUUID() }),
  }).then((res) => {
    if (res.success && res.data?.sessionId) {
      setSessionId(res.data.sessionId);
    }
    return res;
  }),

  // Register new account with username/password
  register: (username: string, password: string, email?: string, displayName?: string) =>
    apiFetch<{ user: User; sessionId: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, displayName }),
    }).then((res) => {
      if (res.success && res.data?.sessionId) {
        setSessionId(res.data.sessionId);
      }
      return res;
    }),

  // Login with username/password
  login: (username: string, password: string) =>
    apiFetch<{ user: User; sessionId: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }).then((res) => {
      if (res.success && res.data?.sessionId) {
        setSessionId(res.data.sessionId);
      }
      return res;
    }),

  // Convert anonymous session to authenticated account
  convertAccount: (username: string, password: string, email?: string, displayName?: string) =>
    apiFetch<{ user: User; message: string }>('/auth/convert', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, displayName }),
    }),

  logout: () => apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }).then((res) => {
    clearSession();
    return res;
  }),
};

// ===== ACCOUNTS =====
export const accounts = {
  getMe: () => apiFetch<AccountWithTotals>('/accounts/me'),

  getLedger: (limit = 50, offset = 0) =>
    apiFetch<{ entries: LedgerEntry[]; account: AccountWithTotals }>(
      `/accounts/me/ledger?limit=${limit}&offset=${offset}`
    ),

  // Legacy deposit method (kept for backwards compatibility)
  createDeposit: (amount: number, currency = 'usd') =>
    apiFetch<{ sessionId: string; checkoutUrl: string }>('/accounts/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount, currency }),
    }),

  getPayments: (limit = 20) => apiFetch<StripePayment[]>(`/accounts/payments?limit=${limit}`),
};

// ===== PAYMENTS (Modular - supports multiple providers) =====
export const payments = {
  // Get available payment providers
  getProviders: () => apiFetch<PaymentProviderInfo[]>('/payments/providers'),

  // Initiate a payment with a specific provider
  initiate: (data: {
    provider: PaymentProviderType;
    amount: number;
    currency?: string;
    escrowId?: string;
    metadata?: Record<string, any>;
  }) =>
    apiFetch<PaymentSession>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get payment by ID
  getById: (id: string) => apiFetch<Payment>(`/payments/${id}`),

  // Verify payment status
  verify: (id: string) => apiFetch<{ id: string; status: PaymentStatus; amount: number; currency: string }>(
    `/payments/${id}/verify`
  ),

  // Get payment history
  getHistory: (limit = 20, offset = 0) =>
    apiFetch<Payment[]>(`/payments?limit=${limit}&offset=${offset}`),
};

// ===== ESCROWS =====
export const escrows = {
  create: (data: CreateEscrowRequest) =>
    apiFetch<EscrowWithParties>('/escrows', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getById: (id: string) => apiFetch<EscrowWithParties>(`/escrows/${id}`),

  getAll: (status?: string) =>
    apiFetch<Escrow[]>(`/escrows${status ? `?status=${status}` : ''}`),

  getPendingForProvider: (serviceTypeId?: string) =>
    apiFetch<Escrow[]>(
      `/escrows/provider/pending${serviceTypeId ? `?serviceTypeId=${serviceTypeId}` : ''}`
    ),

  accept: (id: string) =>
    apiFetch<Escrow>(`/escrows/${id}/accept`, { method: 'POST' }),

  fund: (id: string) =>
    apiFetch<Escrow>(`/escrows/${id}/fund`, { method: 'POST' }),

  confirm: (id: string) =>
    apiFetch<Escrow>(`/escrows/${id}/confirm`, { method: 'POST' }),

  cancel: (id: string, reason?: string) =>
    apiFetch<Escrow>(`/escrows/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getEvents: (id: string) => apiFetch<EscrowEvent[]>(`/escrows/${id}/events`),

  getAttachments: (id: string) => apiFetch<Attachment[]>(`/escrows/${id}/attachments`),

  // Messages
  getMessages: (id: string) => apiFetch<EscrowMessage[]>(`/escrows/${id}/messages`),

  addMessage: (id: string, message: string) =>
    apiFetch<EscrowMessage>(`/escrows/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};

// ===== ATTACHMENTS =====
export const attachments = {
  upload: async (escrowId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (sessionId) {
      headers['X-Session-ID'] = sessionId;
    }

    const response = await fetch(`${API_BASE}/attachments/escrow/${escrowId}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });

    return response.json() as Promise<ApiResponse<Attachment>>;
  },

  getDownloadUrl: (id: string) => `${API_BASE}/attachments/${id}/download`,

  markAsEscrowed: (id: string) =>
    apiFetch<Attachment>(`/attachments/${id}/escrow`, { method: 'POST' }),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/attachments/${id}`, { method: 'DELETE' }),
};

// ===== SETTINGS =====
export const settings = {
  getAutoAcceptRules: () => apiFetch<ProviderSettings[]>('/settings/auto-accept'),

  getAutoAcceptRule: (serviceTypeId: string) =>
    apiFetch<ProviderSettings>(`/settings/auto-accept/${serviceTypeId}`),

  upsertAutoAcceptRule: (
    serviceTypeId: string,
    data: { autoAcceptEnabled: boolean; minAmount?: number; maxAmount?: number }
  ) =>
    apiFetch<ProviderSettings>(`/settings/auto-accept/${serviceTypeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAutoAcceptRule: (serviceTypeId: string) =>
    apiFetch<{ message: string }>(`/settings/auto-accept/${serviceTypeId}`, {
      method: 'DELETE',
    }),

  toggleAutoAccept: (serviceTypeId: string, enabled: boolean) =>
    apiFetch<ProviderSettings>(`/settings/auto-accept/${serviceTypeId}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),

  updateProfile: (data: { displayName?: string; avatarUrl?: string }) =>
    apiFetch<User>('/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ===== ORGANIZATIONS =====
export const organizations = {
  create: (data: { name: string; slug?: string; billingEmail?: string }) =>
    apiFetch<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAll: () => apiFetch<Organization[]>('/organizations'),

  getById: (id: string) =>
    apiFetch<{ organization: Organization; membership: OrgMember }>(`/organizations/${id}`),

  getMembers: (orgId: string) => apiFetch<OrgMember[]>(`/organizations/${orgId}/members`),

  addMember: (orgId: string, email: string, role = 'member') =>
    apiFetch<OrgMember>(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  removeMember: (orgId: string, memberId: string) =>
    apiFetch<{ message: string }>(`/organizations/${orgId}/members/${memberId}`, {
      method: 'DELETE',
    }),

  getAccount: (orgId: string) => apiFetch<AccountWithTotals>(`/organizations/${orgId}/account`),
};

// ===== ARBITER =====
export const arbiter = {
  // Check if current user is arbiter for an escrow
  isArbiter: (escrowId: string) =>
    apiFetch<{ isArbiter: boolean }>(`/admin/escrows/${escrowId}/is-arbiter`),

  // Get escrows where current user is arbiter
  getMyArbitrations: () => apiFetch<Escrow[]>('/admin/my-arbitrations'),

  // Arbiter cancel escrow (refund to Party A)
  cancelEscrow: (escrowId: string, reason: string, refundToPartyA = true) =>
    apiFetch<Escrow>(`/admin/escrows/${escrowId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, refundToPartyA }),
    }),

  // Arbiter force complete escrow (release to Party B)
  forceComplete: (escrowId: string, reason: string) =>
    apiFetch<Escrow>(`/admin/escrows/${escrowId}/force-complete`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// ===== ADMIN =====
export const admin = {
  // Service Types (any authenticated user can read)
  getServiceTypes: () => apiFetch<ServiceType[]>('/admin/service-types'),
  getServiceType: (id: string) => apiFetch<ServiceType>(`/admin/service-types/${id}`),

  // Platform Admin Only - Service Type management
  updateServiceType: (id: string, data: Partial<ServiceType>) =>
    apiFetch<ServiceType>(`/admin/service-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  createServiceType: (data: {
    id: string;
    name: string;
    description?: string;
    platformFeePercent?: number;
    metadataSchema?: Record<string, string>;
  }) =>
    apiFetch<ServiceType>('/admin/service-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Platform Admin Only - Stats
  getStats: () =>
    apiFetch<PlatformStats>('/admin/stats'),

  // Platform Admin Only - Users
  getUsers: (limit = 100, offset = 0, role?: string) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (role) params.append('role', role);
    return apiFetch<AdminUser[]>(`/admin/users?${params.toString()}`);
  },

  updateUserRole: (userId: string, role: UserRole) =>
    apiFetch<User>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  // Platform Admin Only - Organizations
  getOrganizations: (limit = 100, offset = 0) =>
    apiFetch<AdminOrganization[]>(`/admin/organizations?limit=${limit}&offset=${offset}`),

  // Platform Admin Only - Escrows
  getEscrows: (limit = 100, offset = 0, status?: string) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (status) params.append('status', status);
    return apiFetch<AdminEscrow[]>(`/admin/escrows?${params.toString()}`);
  },
};

// Admin-specific types
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

export interface AdminUser {
  id: string;
  email?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  isAuthenticated: boolean;
  isProvider: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  billingEmail?: string;
  isActive: boolean;
  memberCount: number;
  totalBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEscrow {
  id: string;
  serviceTypeId: string;
  serviceTypeName: string;
  partyAUserId: string;
  partyAName?: string;
  partyAEmail?: string;
  partyBUserId?: string;
  partyBName?: string;
  partyBEmail?: string;
  status: EscrowStatus;
  amount: number;
  currency: string;
  platformFee: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ===== SERVICE TYPES (public) =====
export const serviceTypes = {
  getAll: () => apiFetch<ServiceType[]>('/service-types'),
};

// ===== TRAFFIC CALCULATOR (public) =====
export const traffic = {
  calculate: (usd?: number, bytes?: number) => {
    const params = new URLSearchParams();
    if (usd !== undefined) params.append('usd', usd.toString());
    if (bytes !== undefined) params.append('bytes', bytes.toString());
    return apiFetch<{ usd: number; bytes: number; rate: string }>(
      `/traffic/calculate?${params.toString()}`
    );
  },
};

// ===== PLATFORM SETTINGS (public subset) =====
export interface PublicPlatformSettings {
  platformName: string;
  trafficPricePerMB: number;
  minEscrowAmount: number;
  maxEscrowAmount: number;
}

export const platformSettings = {
  getPublic: () => apiFetch<PublicPlatformSettings>('/platform-settings/public'),
};

// ===== CC PRICE (Canton Coin) =====
export interface CCPriceData {
  ccPriceUsd: number;      // Price of 1 CC in USD (e.g., 0.14 means 1 CC = $0.14)
  usdPerCc: number;        // Same as above
  ccPerUsd: number;        // How many CC you get for $1 USD
  source: 'kaiko' | 'default';
  cached: boolean;
  defaultRate: number;
  lastUpdated: string | null;
}

export const ccPrice = {
  get: () => apiFetch<CCPriceData>('/cc-price'),
  refresh: () => apiFetch<{ ccPriceUsd: number; source: string; refreshed: boolean }>('/cc-price/refresh', { method: 'POST' }),
};

// ===== ESCROW TEMPLATES =====
export interface EscrowTemplateConfig {
  serviceTypeId?: string;
  amount?: number;
  currency?: string;
  isOpen?: boolean;
  counterpartyType?: 'open' | 'email' | 'organization';
  counterpartyName?: string;
  counterpartyEmail?: string;
  counterpartyOrgId?: string;
  privacyLevel?: 'public' | 'platform' | 'private';
  arbiterType?: 'platform_only' | 'platform_ai' | 'organization' | 'person';
  arbiterOrgId?: string;
  arbiterEmail?: string;
  title?: string;
  description?: string;
  terms?: string;
  expiresInDays?: number;
  metadata?: Record<string, any>;
}

export interface EscrowTemplate {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  serviceTypeId: string | null;
  serviceTypeName?: string;
  isPlatformTemplate: boolean;
  config: EscrowTemplateConfig;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  serviceTypeId?: string;
  config: EscrowTemplateConfig;
}

export const templates = {
  // Get all templates for current user (includes platform templates)
  getAll: () => apiFetch<EscrowTemplate[]>('/templates'),

  // Get user's own templates only
  getMine: () => apiFetch<EscrowTemplate[]>('/templates/mine'),

  // Get platform templates only
  getPlatform: () => apiFetch<EscrowTemplate[]>('/templates/platform'),

  // Get a single template by ID
  getById: (id: string) => apiFetch<EscrowTemplate>(`/templates/${id}`),

  // Create a new template
  create: (data: CreateTemplateInput) =>
    apiFetch<EscrowTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update a template
  update: (id: string, data: Partial<CreateTemplateInput>) =>
    apiFetch<EscrowTemplate>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete a template
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/templates/${id}`, {
      method: 'DELETE',
    }),

  // Record template usage
  recordUsage: (id: string) =>
    apiFetch<{ message: string }>(`/templates/${id}/use`, {
      method: 'POST',
    }),
};

// ===== TYPE DEFINITIONS =====
// These match the backend types

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

export type PrivacyLevel = 'public' | 'platform' | 'private';

export type ArbiterType = 'platform_only' | 'platform_ai' | 'organization' | 'person';

export type ServiceTypeId = 'TRAFFIC_BUY' | 'DOCUMENT_DELIVERY' | 'API_KEY_EXCHANGE' | 'CUSTOM';

export type UserRole = 'user' | 'provider' | 'admin' | 'platform_admin';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  billingEmail?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  primaryOrgId?: string;  // Every user belongs to an org
  createdAt: string;
  updatedAt: string;
}

export interface AccountWithTotals {
  id: string;
  userId?: string;
  organizationId?: string;
  availableBalance: number;
  inContractBalance: number;
  totalBalance: number;
  currency: string;
  ownerType: 'user' | 'organization';
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  amount: number;
  bucket: 'available' | 'in_contract';
  entryType: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

export interface Escrow {
  id: string;
  serviceTypeId: ServiceTypeId;
  // Organization-based ownership (new model)
  partyAOrgId: string;              // Organization creating the escrow (required)
  createdByUserId: string;          // User who created it (for audit)
  partyBOrgId?: string;             // Counterparty org (if assigned to org)
  partyBUserId?: string;            // Counterparty user (if assigned to specific user)
  acceptedByUserId?: string;        // User who accepted (for audit)
  // Legacy field
  partyAUserId?: string;            // @deprecated - use createdByUserId
  // Counterparty details
  isOpen: boolean;
  counterpartyName?: string;
  counterpartyEmail?: string;
  // Privacy level
  privacyLevel: PrivacyLevel;
  // Arbiter (dispute resolution)
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
  partyAConfirmedAt?: string;
  partyBConfirmedAt?: string;
  fundedAt?: string;
  completedAt?: string;
  canceledAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
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

export interface EscrowEvent {
  id: string;
  escrowId: string;
  eventType: string;
  actorUserId?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface EscrowMessage {
  id: string;
  escrowId: string;
  userId: string;
  message: string;
  isSystemMessage: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  user?: {
    id: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
  };
}

export interface ServiceType {
  id: ServiceTypeId;
  name: string;
  description?: string;
  partyADelivers: { type: string; label: string };
  partyBDelivers: { type: string; label: string };
  platformFeePercent: number;
  autoAcceptable: boolean;
  requiresPartyAConfirmation: boolean;
  requiresPartyBConfirmation: boolean;
  metadataSchema?: Record<string, string>;
  isActive: boolean;
  createdAt: string;
}

export interface ProviderSettings {
  id: string;
  userId: string;
  serviceTypeId: ServiceTypeId;
  autoAcceptEnabled: boolean;
  maxAmount?: number;
  minAmount?: number;
  capabilities?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Purpose categorizes what an attachment is for
export type AttachmentPurpose =
  | 'evidence_a'      // Party A proving they did their part
  | 'evidence_b'      // Party B proving they did their part
  | 'deliverable_a'   // The actual item Party A is delivering (e.g., payment receipt)
  | 'deliverable_b'   // The actual item Party B is delivering (e.g., document, API key)
  | 'general';        // General attachment (notes, context, etc.)

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

export interface Attachment {
  id: string;
  escrowId: string;
  uploadedByUserId: string;
  attachmentType: 'DOCUMENT' | 'IMAGE' | 'TEXT' | 'ARCHIVE' | 'LINK';
  purpose?: AttachmentPurpose;  // What this attachment is proving or delivering
  filename: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
  status: 'UPLOADED' | 'ESCROWED' | 'RELEASED' | 'DELETED';
  releasedToUserId?: string;
  releasedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  billingEmail?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  canUseOrgAccount: boolean;
  canCreateEscrows: boolean;
  canManageMembers: boolean;
  joinedAt: string;
}

export interface StripePayment {
  id: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  userId: string;
  escrowId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  createdAt: string;
  updatedAt: string;
}

// ===== PAYMENT PROVIDER TYPES =====
export type PaymentProviderType = 'stripe' | 'crypto' | 'bank' | string;
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'expired';

export interface PaymentProviderInfo {
  type: PaymentProviderType;
  name: string;
  description: string;
  icon?: string;
  enabled: boolean;
  comingSoon?: boolean;
  minAmount?: number;
  maxAmount?: number;
  supportedCurrencies?: string[];
}

export interface PaymentSession {
  id: string;
  provider: PaymentProviderType;
  externalId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  redirectUrl?: string;
  expiresAt?: string;
  metadata: Record<string, any>;
}

export interface Payment {
  id: string;
  userId: string;
  escrowId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProviderType;
  externalId?: string;
  providerData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

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
  createdAt: string;
}
