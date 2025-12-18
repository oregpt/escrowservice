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

  login: (email: string, displayName?: string) =>
    apiFetch<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, displayName }),
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

  createDeposit: (amount: number, currency = 'usd') =>
    apiFetch<{ sessionId: string; checkoutUrl: string }>('/accounts/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount, currency }),
    }),

  getPayments: (limit = 20) => apiFetch<StripePayment[]>(`/accounts/payments?limit=${limit}`),
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

// ===== ADMIN =====
export const admin = {
  getServiceTypes: () => apiFetch<ServiceType[]>('/admin/service-types'),

  getServiceType: (id: string) => apiFetch<ServiceType>(`/admin/service-types/${id}`),

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

  getStats: () =>
    apiFetch<{
      escrows: { active: number; completed: number; pending: number; total: number };
      users: { total: number; providers: number };
      volume: { total: number; fees: number };
    }>('/admin/stats'),
};

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

export type ServiceTypeId = 'TRAFFIC_BUY' | 'DOCUMENT_DELIVERY' | 'API_KEY_EXCHANGE' | 'CUSTOM';

export interface User {
  id: string;
  externalId?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  isAuthenticated: boolean;
  isProvider: boolean;
  sessionId?: string;
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
  partyAUserId: string;
  partyBUserId?: string;
  status: EscrowStatus;
  amount: number;
  currency: string;
  platformFee: number;
  metadata?: Record<string, any>;
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
  partyA: User;
  partyB?: User;
  serviceType: ServiceType;
  attachments: Attachment[];
}

export interface EscrowEvent {
  id: string;
  escrowId: string;
  eventType: string;
  actorUserId?: string;
  details?: Record<string, any>;
  createdAt: string;
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

export interface Attachment {
  id: string;
  escrowId: string;
  uploadedByUserId: string;
  attachmentType: 'DOCUMENT' | 'IMAGE' | 'TEXT' | 'ARCHIVE' | 'LINK';
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

export interface CreateEscrowRequest {
  serviceTypeId: ServiceTypeId;
  amount: number;
  currency?: string;
  metadata?: Record<string, any>;
  expiresInDays?: number;
}
