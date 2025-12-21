import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  auth,
  accounts,
  payments,
  escrows,
  settings,
  organizations,
  admin,
  serviceTypes,
  orgServiceTypes,
  traffic,
  attachments,
  platformSettings,
  ccPrice,
  templates,
  type User,
  type UserRole,
  type AccountWithTotals,
  type Escrow,
  type EscrowWithParties,
  type EscrowMessage,
  type ProviderSettings,
  type ServiceType,
  type Organization,
  type CreateEscrowRequest,
  type PlatformStats,
  type AdminUser,
  type AdminOrganization,
  type AdminEscrow,
  type PaymentProviderInfo,
  type PaymentProviderType,
  type Payment,
  type PublicPlatformSettings,
  type EscrowTemplate,
  type EscrowTemplateConfig,
  type CreateTemplateInput,
} from '@/lib/api';

// ===== AUTH HOOKS =====

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await auth.getMe();
      return res.success ? res.data : null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Register new account with username/password
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      password,
      email,
      displayName,
      organizationName,
    }: {
      username: string;
      password: string;
      email?: string;
      displayName?: string;
      organizationName?: string;
    }) => {
      const res = await auth.register(username, password, email, displayName, organizationName);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

// Login with username/password
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await auth.login(username, password);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
    },
  });
}

// Convert anonymous session to authenticated account
export function useConvertAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      username,
      password,
      email,
      displayName,
    }: {
      username: string;
      password: string;
      email?: string;
      displayName?: string;
    }) => {
      const res = await auth.convertAccount(username, password, email, displayName);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await auth.logout();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
    },
  });
}

// Request password reset email
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await auth.forgotPassword(email);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

// Validate reset token
export function useValidateResetToken(token: string) {
  return useQuery({
    queryKey: ['reset-token', token],
    queryFn: async () => {
      const res = await auth.validateResetToken(token);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!token,
    retry: false,
  });
}

// Reset password with token
export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const res = await auth.resetPassword(token, password);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await auth.createSession();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

// ===== ACCOUNT HOOKS =====

export function useAccount() {
  return useQuery({
    queryKey: ['account', 'me'],
    queryFn: async () => {
      const res = await accounts.getMe();
      return res.success ? res.data : null;
    },
  });
}

// Get all accounts for user (org + personal wallets)
export function useAllAccounts() {
  return useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: async () => {
      const res = await accounts.getAll();
      return res.success ? res.data : [];
    },
  });
}

export function useLedger(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['account', 'ledger', limit, offset],
    queryFn: async () => {
      const res = await accounts.getLedger(limit, offset);
      return res.success ? res.data : null;
    },
  });
}

export function useCreateDeposit() {
  return useMutation({
    mutationFn: async ({ amount, currency = 'usd' }: { amount: number; currency?: string }) => {
      const res = await accounts.createDeposit(amount, currency);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

// New deposit with account type selection
export function useDepositToAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount,
      orgId,
      accountType,
      currency = 'usd',
    }: {
      amount: number;
      orgId: string;
      accountType: 'organization' | 'personal';
      currency?: string;
    }) => {
      const res = await accounts.depositToAccount(amount, orgId, accountType, currency);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

// ===== PAYMENT HOOKS (Modular Payment System) =====

export function usePaymentProviders() {
  return useQuery({
    queryKey: ['payments', 'providers'],
    queryFn: async () => {
      const res = await payments.getProviders();
      return res.success ? res.data : [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - providers rarely change
  });
}

export function useInitiatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      provider: PaymentProviderType;
      amount: number;
      currency?: string;
      escrowId?: string;
      metadata?: Record<string, any>;
    }) => {
      const res = await payments.initiate(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ['payments', id],
    queryFn: async () => {
      const res = await payments.getById(id);
      return res.success ? res.data : null;
    },
    enabled: !!id,
  });
}

export function usePaymentHistory(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ['payments', 'history', { limit, offset }],
    queryFn: async () => {
      const res = await payments.getHistory(limit, offset);
      return res.success ? res.data : [];
    },
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await payments.verify(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

// ===== ESCROW HOOKS =====

export function useEscrows(status?: string) {
  return useQuery({
    queryKey: ['escrows', 'list', status],
    queryFn: async () => {
      const res = await escrows.getAll(status);
      return res.success ? res.data : [];
    },
  });
}

export function useEscrow(id: string) {
  return useQuery({
    queryKey: ['escrows', id],
    queryFn: async () => {
      const res = await escrows.getById(id);
      return res.success ? res.data : null;
    },
    enabled: !!id,
  });
}

export function usePendingEscrows(serviceTypeId?: string) {
  return useQuery({
    queryKey: ['escrows', 'pending', serviceTypeId],
    queryFn: async () => {
      const res = await escrows.getPendingForProvider(serviceTypeId);
      return res.success ? res.data : [];
    },
  });
}

export function useEscrowEvents(id: string) {
  return useQuery({
    queryKey: ['escrows', id, 'events'],
    queryFn: async () => {
      const res = await escrows.getEvents(id);
      return res.success ? res.data : [];
    },
    enabled: !!id,
  });
}

export function useEscrowAttachments(id: string) {
  return useQuery({
    queryKey: ['escrows', id, 'attachments'],
    queryFn: async () => {
      const res = await escrows.getAttachments(id);
      return res.success ? res.data : [];
    },
    enabled: !!id,
  });
}

export function useEscrowMessages(id: string) {
  return useQuery({
    queryKey: ['escrows', id, 'messages'],
    queryFn: async () => {
      const res = await escrows.getMessages(id);
      return res.success ? res.data : [];
    },
    enabled: !!id,
  });
}

export function useAddMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ escrowId, message }: { escrowId: string; message: string }) => {
      const res = await escrows.addMessage(escrowId, message);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, { escrowId }) => {
      queryClient.invalidateQueries({ queryKey: ['escrows', escrowId, 'messages'] });
    },
  });
}

export function useCreateEscrow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEscrowRequest) => {
      const res = await escrows.create(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useAcceptEscrow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await escrows.accept(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
      queryClient.invalidateQueries({ queryKey: ['escrows', id] });
    },
  });
}

export function useFundEscrow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await escrows.fund(id, notes);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
      queryClient.invalidateQueries({ queryKey: ['escrows', id] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useConfirmEscrow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await escrows.confirm(id, notes);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
      queryClient.invalidateQueries({ queryKey: ['escrows', id] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

export function useCancelEscrow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await escrows.cancel(id, reason);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['escrows'] });
      queryClient.invalidateQueries({ queryKey: ['escrows', id] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
    },
  });
}

// ===== ATTACHMENT HOOKS =====

export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      escrowId,
      file,
      confirmationStep,
      holdUntilCompletion,
      notes,
    }: {
      escrowId: string;
      file: File;
      confirmationStep?: 'FUNDING' | 'PARTY_B_CONFIRM' | 'PARTY_A_CONFIRM';
      holdUntilCompletion?: boolean;
      notes?: string;
    }) => {
      const res = await attachments.upload(escrowId, file, {
        confirmationStep,
        holdUntilCompletion,
        notes,
      });
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, { escrowId }) => {
      queryClient.invalidateQueries({ queryKey: ['escrows', escrowId, 'attachments'] });
    },
  });
}

// ===== SETTINGS HOOKS =====

export function useAutoAcceptRules() {
  return useQuery({
    queryKey: ['settings', 'auto-accept'],
    queryFn: async () => {
      const res = await settings.getAutoAcceptRules();
      return res.success ? res.data : [];
    },
  });
}

export function useUpdateAutoAcceptRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      serviceTypeId,
      data,
    }: {
      serviceTypeId: string;
      data: { autoAcceptEnabled: boolean; minAmount?: number; maxAmount?: number };
    }) => {
      const res = await settings.upsertAutoAcceptRule(serviceTypeId, data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'auto-accept'] });
    },
  });
}

export function useToggleAutoAccept() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceTypeId, enabled }: { serviceTypeId: string; enabled: boolean }) => {
      const res = await settings.toggleAutoAccept(serviceTypeId, enabled);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'auto-accept'] });
    },
  });
}

export function useDeleteAutoAcceptRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceTypeId: string) => {
      const res = await settings.deleteAutoAcceptRule(serviceTypeId);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'auto-accept'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { displayName?: string; avatarUrl?: string }) => {
      const res = await settings.updateProfile(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

// ===== ORGANIZATION HOOKS =====

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await organizations.getAll();
      return res.success ? res.data : [];
    },
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: ['organizations', id],
    queryFn: async () => {
      const res = await organizations.getById(id);
      return res.success ? res.data : null;
    },
    enabled: !!id,
  });
}

export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: async () => {
      const res = await organizations.getMembers(orgId);
      return res.success ? res.data : [];
    },
    enabled: !!orgId,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; slug?: string; billingEmail?: string }) => {
      const res = await organizations.create(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

// ===== ADMIN HOOKS =====

export function useAdminServiceTypes() {
  return useQuery({
    queryKey: ['admin', 'service-types'],
    queryFn: async () => {
      const res = await admin.getServiceTypes();
      return res.success ? res.data : [];
    },
  });
}

export function useUpdateServiceType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceType> }) => {
      const res = await admin.updateServiceType(id, data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'service-types'] });
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
    },
  });
}

export function useCreateServiceType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      description?: string;
      platformFeePercent?: number;
      metadataSchema?: Record<string, string>;
    }) => {
      const res = await admin.createServiceType(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'service-types'] });
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
    },
  });
}

// Platform Admin Stats
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await admin.getStats();
      return res.success ? res.data : null;
    },
  });
}

// Platform Admin - All Users
export function useAdminUsers(limit = 100, offset = 0, role?: string) {
  return useQuery({
    queryKey: ['admin', 'users', { limit, offset, role }],
    queryFn: async () => {
      const res = await admin.getUsers(limit, offset, role);
      return res.success ? res.data : [];
    },
  });
}

// Platform Admin - Update User Role
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await admin.updateUserRole(userId, role);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// Platform Admin - All Organizations
export function useAdminOrganizations(limit = 100, offset = 0) {
  return useQuery({
    queryKey: ['admin', 'organizations', { limit, offset }],
    queryFn: async () => {
      const res = await admin.getOrganizations(limit, offset);
      return res.success ? res.data : [];
    },
  });
}

// Platform Admin - All Escrows
export function useAdminEscrows(limit = 100, offset = 0, status?: string) {
  return useQuery({
    queryKey: ['admin', 'escrows', { limit, offset, status }],
    queryFn: async () => {
      const res = await admin.getEscrows(limit, offset, status);
      return res.success ? res.data : [];
    },
  });
}

// ===== SERVICE TYPES HOOKS =====

export function useServiceTypes() {
  return useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await serviceTypes.getAll();
      return res.success ? res.data : [];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - these rarely change
  });
}

// Get available service types for current user's org (filtered by platform AND org settings)
export function useAvailableServiceTypes() {
  return useQuery({
    queryKey: ['service-types', 'available'],
    queryFn: async () => {
      const res = await serviceTypes.getAvailable();
      return res.success ? res.data : [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - may change when org admin toggles
  });
}

// Get service types with org status (for org admin UI)
export function useOrgServiceTypes(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-service-types', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await orgServiceTypes.getForOrg(orgId);
      return res.success ? res.data : [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Toggle org service type enabled/disabled
export function useToggleOrgServiceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, serviceTypeId, isEnabled }: { orgId: string; serviceTypeId: string; isEnabled: boolean }) => {
      const res = await orgServiceTypes.toggle(orgId, serviceTypeId, isEnabled);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-service-types', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['service-types', 'available'] });
    },
  });
}

// ===== TRAFFIC CALCULATOR =====

export function useTrafficCalculator() {
  return useMutation({
    mutationFn: async ({ usd, bytes }: { usd?: number; bytes?: number }) => {
      const res = await traffic.calculate(usd, bytes);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });
}

// ===== PLATFORM SETTINGS (Public) =====

export function usePublicPlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings', 'public'],
    queryFn: async () => {
      const res = await platformSettings.getPublic();
      return res.success ? res.data : null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour - these rarely change
  });
}

// ===== CC PRICE (Canton Coin) =====

export function useCCPrice() {
  return useQuery({
    queryKey: ['cc-price'],
    queryFn: async () => {
      const res = await ccPrice.get();
      return res.success ? res.data : null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - matches backend cache
  });
}

export function useRefreshCCPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await ccPrice.refresh();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cc-price'] });
    },
  });
}

// ===== ESCROW TEMPLATES =====

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await templates.getAll();
      return res.success ? res.data : [];
    },
  });
}

export function useMyTemplates() {
  return useQuery({
    queryKey: ['templates', 'mine'],
    queryFn: async () => {
      const res = await templates.getMine();
      return res.success ? res.data : [];
    },
  });
}

export function usePlatformTemplates() {
  return useQuery({
    queryKey: ['templates', 'platform'],
    queryFn: async () => {
      const res = await templates.getPlatform();
      return res.success ? res.data : [];
    },
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: async () => {
      const res = await templates.getById(id);
      return res.success ? res.data : null;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTemplateInput) => {
      const res = await templates.create(data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTemplateInput> }) => {
      const res = await templates.update(id, data);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await templates.delete(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useRecordTemplateUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await templates.recordUsage(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
