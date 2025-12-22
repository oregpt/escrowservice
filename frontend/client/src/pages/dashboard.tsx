import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSummary } from "@/components/account/AccountSummary";
import { EscrowCard } from "@/components/escrow/EscrowCard";
import { ExecuteTrafficPurchaseModal } from "@/components/escrow/ExecuteTrafficPurchaseModal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Plus, Loader2, UserCheck, Bell, ArrowRight, Wallet, Settings } from "lucide-react";
import { useEscrows, usePendingEscrows, useAccount, useAcceptEscrow, useCancelEscrow, useFundEscrow, useConfirmEscrow, useAuth, useUploadAttachment, useIsFeatureEnabled } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Dashboard() {
  const { toast } = useToast();
  const [escrowFilter, setEscrowFilter] = useState<'all' | 'org'>('all');
  // Role filter checkboxes (apply to both tabs)
  const [showOriginatedByMe, setShowOriginatedByMe] = useState(true);
  const [showImTheProvider, setShowImTheProvider] = useState(true);
  const [showAllOther, setShowAllOther] = useState(false);
  // Execute Traffic Purchase modal state
  const [executeTrafficEscrow, setExecuteTrafficEscrow] = useState<any | null>(null);

  // Fetch data from API
  const { data: authData } = useAuth();

  // Check feature flags for traffic buyer
  const trafficBuyerEnabled = useIsFeatureEnabled('traffic_buyer');
  const { data: escrows, isLoading: escrowsLoading } = useEscrows();
  const { data: pendingEscrows, isLoading: pendingLoading } = usePendingEscrows();
  const { data: account, isLoading: accountLoading } = useAccount();

  const userId = authData?.user?.id;
  const userOrgId = authData?.user?.primaryOrgId;
  const userEmail = authData?.user?.email;

  // Mutations
  const acceptEscrow = useAcceptEscrow();
  const cancelEscrow = useCancelEscrow();
  const fundEscrow = useFundEscrow();
  const confirmEscrow = useConfirmEscrow();
  const uploadAttachment = useUploadAttachment();

  // Separate pending escrows into categories:
  // 1. Assigned specifically to you (by userId OR by email invite)
  // 2. Assigned to your organization (any member can accept)
  // Note: True "open offers" (anyone can accept) just appear in the regular deals list
  const assignedToYou = pendingEscrows?.filter(e =>
    e.partyBUserId === userId ||
    (userEmail && e.counterpartyEmail?.toLowerCase() === userEmail.toLowerCase())
  ) || [];
  const assignedToYourOrg = pendingEscrows?.filter(e =>
    e.partyBOrgId === userOrgId && e.partyBUserId !== userId &&
    !(userEmail && e.counterpartyEmail?.toLowerCase() === userEmail.toLowerCase())
  ) || [];

  // Filter active escrows (not completed/canceled)
  const allActiveEscrows = escrows?.filter(e =>
    !['COMPLETED', 'CANCELED', 'EXPIRED'].includes(e.status)
  ) || [];

  // Organization escrows - ALL escrows where user's org is involved (Party A or Party B)
  const orgEscrows = allActiveEscrows.filter(e =>
    e.partyAOrgId === userOrgId || e.partyBOrgId === userOrgId
  );

  // Apply role filter to escrows (works for both tabs)
  const applyRoleFilter = (escrowList: typeof allActiveEscrows) => {
    return escrowList.filter(e => {
      const isOriginator = e.createdByUserId === userId || e.partyAUserId === userId;
      const isProvider = e.partyBUserId === userId || (e.partyBOrgId === userOrgId && e.partyBUserId === userId);
      const isOther = !isOriginator && !isProvider;

      // If all checkboxes unchecked, show nothing
      if (!showOriginatedByMe && !showImTheProvider && !showAllOther) return false;

      // Check each role and see if any matching checkbox is checked
      if (isOriginator && showOriginatedByMe) return true;
      if (isProvider && showImTheProvider) return true;
      if (isOther && showAllOther) return true;

      return false;
    });
  };

  // Apply tab filter, then role filter
  const baseEscrows = escrowFilter === 'org' ? orgEscrows : allActiveEscrows;
  const activeEscrows = applyRoleFilter(baseEscrows);

  // Total pending count for notification
  const totalPendingCount = assignedToYou.length + assignedToYourOrg.length;

  const handleAccept = async (escrowId: string) => {
    try {
      await acceptEscrow.mutateAsync(escrowId);
      toast({
        title: "Deal Accepted",
        description: "You have accepted the deal. It's now pending funding.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept deal",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (escrowId: string) => {
    // Rejecting just means not accepting - we don't do anything
    toast({
      title: "Rejected",
      description: "You have declined this deal request.",
    });
  };

  const handleFund = async (escrowId: string, notes?: string) => {
    try {
      await fundEscrow.mutateAsync({ id: escrowId, notes });
      toast({
        title: "Deal Funded",
        description: "The deal has been funded and is now active.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fund deal",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = async (escrowId: string, notes?: string) => {
    try {
      await confirmEscrow.mutateAsync({ id: escrowId, notes });
      toast({
        title: "Confirmed",
        description: "You have confirmed the deliverable.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to confirm",
        variant: "destructive",
      });
    }
  };

  // Enhanced handler for fund with modal data (notes, file, holdUntilCompletion)
  const handleFundWithData = async (escrowId: string, data: { notes: string; file?: File; holdUntilCompletion: boolean }) => {
    try {
      // Upload attachment first if file provided
      if (data.file) {
        await uploadAttachment.mutateAsync({
          escrowId,
          file: data.file,
          confirmationStep: 'FUNDING',
          holdUntilCompletion: data.holdUntilCompletion,
          notes: data.notes,
        });
      }
      // Then fund the escrow
      await fundEscrow.mutateAsync({ id: escrowId, notes: data.notes });
      toast({
        title: "Deal Funded",
        description: data.file
          ? "The deal has been funded with your attachment."
          : "The deal has been funded and is now active.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fund deal",
        variant: "destructive",
      });
    }
  };

  // Enhanced handler for confirm with modal data (notes, file, holdUntilCompletion)
  const handleConfirmWithData = async (
    escrowId: string,
    confirmStep: 'PARTY_B_CONFIRM' | 'PARTY_A_CONFIRM',
    data: { notes: string; file?: File; holdUntilCompletion: boolean }
  ) => {
    try {
      // Upload attachment first if file provided
      if (data.file) {
        await uploadAttachment.mutateAsync({
          escrowId,
          file: data.file,
          confirmationStep: confirmStep,
          holdUntilCompletion: data.holdUntilCompletion,
          notes: data.notes,
        });
      }
      // Then confirm the escrow
      await confirmEscrow.mutateAsync({ id: escrowId, notes: data.notes });
      toast({
        title: "Confirmed",
        description: data.file
          ? "You have confirmed with your attachment."
          : "You have confirmed the deliverable.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to confirm",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async (escrowId: string) => {
    try {
      await cancelEscrow.mutateAsync({ id: escrowId });
      toast({
        title: "Deal Canceled",
        description: "The deal has been canceled.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel deal",
        variant: "destructive",
      });
    }
  };

  // Helper to determine what actions are available for a given escrow
  const getEscrowActions = (escrow: typeof activeEscrows[0]) => {
    const isPartyA = escrow.partyAUserId === userId || escrow.createdByUserId === userId;
    const isPartyB = escrow.partyBUserId === userId;
    const isOpenOffer = escrow.status === 'PENDING' && !escrow.partyBUserId;

    return {
      // Accept: available for pending deals where user is assigned or it's an open offer
      canAccept: (escrow.status === 'PENDING' || escrow.status === 'PENDING_ACCEPTANCE') &&
        !isPartyA && (isPartyB || isOpenOffer ||
          (userEmail && escrow.counterpartyEmail?.toLowerCase() === userEmail.toLowerCase())),

      // Fund: available when PENDING_FUNDING and user is partyA (or partyB depending on deal type)
      canFund: escrow.status === 'PENDING_FUNDING' && isPartyA,

      // Confirm: available when FUNDED and user is partyB, or when PARTY_B_CONFIRMED and user is partyA
      canConfirm: (escrow.status === 'FUNDED' && isPartyB) ||
        (escrow.status === 'PARTY_B_CONFIRMED' && isPartyA),

      // Cancel: only available for partyA BEFORE partyB accepts (PENDING status only)
      // Once accepted/funded, only platform arbiter can cancel
      canCancel: isPartyA && escrow.status === 'PENDING',

      // Execute Traffic Purchase: for TRAFFIC_BUY escrows when Party B and FUNDED
      canExecuteTraffic: escrow.status === 'FUNDED' &&
        isPartyB &&
        escrow.serviceTypeId === 'TRAFFIC_BUY' &&
        trafficBuyerEnabled,
    };
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        {/* Prominent Pending Notification Banner */}
        {!pendingLoading && totalPendingCount > 0 && (
          <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-900">
            <Bell className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900 font-semibold">
              You have {totalPendingCount} pending deal{totalPendingCount > 1 ? 's' : ''} awaiting action
            </AlertTitle>
            <AlertDescription className="text-amber-800 flex items-center justify-between">
              <span>
                {assignedToYou.length > 0 && `${assignedToYou.length} assigned to you`}
                {assignedToYou.length > 0 && assignedToYourOrg.length > 0 && ' • '}
                {assignedToYourOrg.length > 0 && `${assignedToYourOrg.length} for your organization`}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-4 border-amber-300 text-amber-900 hover:bg-amber-100"
                onClick={() => document.getElementById('pending-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Review Now <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Active Deals</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your secure transactions.</p>
              </div>
              <Link href="/escrow/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New Deal
                </Button>
              </Link>
            </div>

            {/* Inbox Section for Pending Acceptance */}
            <div id="pending-section">
            {pendingLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Escrows Assigned to You */}
                {assignedToYou.length > 0 && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                      Assigned to You ({assignedToYou.length})
                    </h3>
                    <div className="space-y-3">
                      {assignedToYou.map((escrow) => (
                        <div key={escrow.id} className="bg-white p-3 rounded border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="font-medium text-sm">{escrow.title || escrow.serviceTypeId.replace('_', ' ')}</div>
                            <div className="text-xs text-muted-foreground">
                              From: {escrow.createdByUserId?.slice(0, 8) || escrow.partyAUserId?.slice(0, 8) || 'Unknown'} • ${escrow.amount.toFixed(2)} {escrow.currency}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                              onClick={() => handleReject(escrow.id)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleAccept(escrow.id)}
                              disabled={acceptEscrow.isPending}
                            >
                              {acceptEscrow.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Accept & Fund"
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Escrows Assigned to Your Organization */}
                {assignedToYourOrg.length > 0 && (
                  <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Assigned to Your Organization ({assignedToYourOrg.length})
                    </h3>
                    <p className="text-xs text-purple-700 mb-3">Any member of your organization can accept these.</p>
                    <div className="space-y-3">
                      {assignedToYourOrg.map((escrow) => (
                        <div key={escrow.id} className="bg-white p-3 rounded border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="font-medium text-sm">{escrow.title || escrow.serviceTypeId.replace('_', ' ')}</div>
                            <div className="text-xs text-muted-foreground">
                              From: {escrow.createdByUserId?.slice(0, 8) || escrow.partyAUserId?.slice(0, 8) || 'Unknown'} • ${escrow.amount.toFixed(2)} {escrow.currency}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/escrow/${escrow.id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                              >
                                View
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={() => handleAccept(escrow.id)}
                              disabled={acceptEscrow.isPending}
                            >
                              {acceptEscrow.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Accept"
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </>
            )}
            </div>

            {/* Escrow Filter Tabs */}
            {userOrgId && allActiveEscrows.length > 0 && (
              <div className="space-y-3">
                <Tabs value={escrowFilter} onValueChange={(v) => setEscrowFilter(v as 'all' | 'org')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="all" className="text-sm">
                      All Deals ({allActiveEscrows.length})
                    </TabsTrigger>
                    <TabsTrigger value="org" className="text-sm">
                      My Organization ({orgEscrows.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Role filter checkboxes - show for both tabs */}
                <div className="flex items-center gap-6 px-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="originated-by-me"
                      checked={showOriginatedByMe}
                      onCheckedChange={(checked) => setShowOriginatedByMe(checked === true)}
                    />
                    <Label htmlFor="originated-by-me" className="text-sm text-muted-foreground cursor-pointer">
                      I'm Originator
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="im-the-provider"
                      checked={showImTheProvider}
                      onCheckedChange={(checked) => setShowImTheProvider(checked === true)}
                    />
                    <Label htmlFor="im-the-provider" className="text-sm text-muted-foreground cursor-pointer">
                      I'm Counterparty
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="all-other"
                      checked={showAllOther}
                      onCheckedChange={(checked) => setShowAllOther(checked === true)}
                    />
                    <Label htmlFor="all-other" className="text-sm text-muted-foreground cursor-pointer">
                      All Other
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Active Escrows List */}
            {escrowsLoading ? (
              <div className="flex items-center justify-center p-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : activeEscrows.length > 0 ? (
              <div className="grid gap-4">
                {activeEscrows.map(escrow => {
                  const actions = getEscrowActions(escrow);
                  return (
                    <EscrowCard
                      key={escrow.id}
                      id={escrow.id}
                      serviceType={escrow.serviceTypeId}
                      serviceTypeId={escrow.serviceTypeId}
                      status={escrow.status}
                      amount={escrow.amount}
                      currency={escrow.currency}
                      partyA={{ name: escrow.partyAUserId === userId ? "You" : "Originator" }}
                      partyB={escrow.partyBUserId ? { name: escrow.partyBUserId === userId ? "You" : "Counterparty" } : null}
                      createdAt={new Date(escrow.createdAt).toLocaleDateString()}
                      expiresAt={escrow.expiresAt ? new Date(escrow.expiresAt).toLocaleDateString() : undefined}
                      isOpen={!escrow.partyBUserId && escrow.status === 'PENDING'}
                      canAccept={actions.canAccept}
                      onAccept={() => handleAccept(escrow.id)}
                      isAccepting={acceptEscrow.isPending}
                      canFund={actions.canFund}
                      onFund={() => handleFund(escrow.id)}
                      onFundWithData={(data) => handleFundWithData(escrow.id, data)}
                      isFunding={fundEscrow.isPending || uploadAttachment.isPending}
                      canConfirm={actions.canConfirm}
                      onConfirm={() => handleConfirm(escrow.id)}
                      onConfirmWithData={(data) => {
                        const step = escrow.status === 'FUNDED' ? 'PARTY_B_CONFIRM' : 'PARTY_A_CONFIRM';
                        return handleConfirmWithData(escrow.id, step, data);
                      }}
                      confirmStep={escrow.status === 'FUNDED' ? 'PARTY_B_CONFIRM' : 'PARTY_A_CONFIRM'}
                      isConfirming={confirmEscrow.isPending || uploadAttachment.isPending}
                      canCancel={actions.canCancel}
                      onCancel={() => handleCancel(escrow.id)}
                      isCanceling={cancelEscrow.isPending}
                      canExecuteTraffic={actions.canExecuteTraffic}
                      onExecuteTraffic={() => setExecuteTrafficEscrow(escrow)}
                      isExecutingTraffic={false}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="mb-4">No active deals</p>
                <Link href="/escrow/new">
                  <Button>Create Your First Deal</Button>
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <AccountSummary
              totalBalance={account?.totalBalance || 0}
              availableBalance={account?.availableBalance || 0}
              inContractBalance={account?.inContractBalance || 0}
              currency={account?.currency || "USD"}
              isLoading={accountLoading}
            />

            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
              <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/escrow/new">
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="mr-2 h-4 w-4" /> Create Deal
                  </Button>
                </Link>
                <Link href="/account">
                  <Button variant="outline" className="w-full justify-start">
                    <Wallet className="mr-2 h-4 w-4" /> View Balances
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="mr-2 h-4 w-4" /> Auto-Accept Settings
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Execute Traffic Purchase Modal */}
      {executeTrafficEscrow && (
        <ExecuteTrafficPurchaseModal
          escrow={{
            ...executeTrafficEscrow,
            partyAUser: null,
            partyBUser: null,
          }}
          open={!!executeTrafficEscrow}
          onOpenChange={(open) => !open && setExecuteTrafficEscrow(null)}
        />
      )}
    </div>
  );
}
