import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSummary } from "@/components/account/AccountSummary";
import { EscrowCard } from "@/components/escrow/EscrowCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Plus, Loader2, Globe, UserCheck, Bell, ArrowRight, Wallet, Settings } from "lucide-react";
import { useEscrows, usePendingEscrows, useAccount, useAcceptEscrow, useCancelEscrow, useAuth } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Dashboard() {
  const { toast } = useToast();
  const [escrowFilter, setEscrowFilter] = useState<'all' | 'org'>('all');
  // Role filter checkboxes (apply to both tabs)
  const [showOriginatedByMe, setShowOriginatedByMe] = useState(true);
  const [showImTheProvider, setShowImTheProvider] = useState(true);

  // Fetch data from API
  const { data: authData } = useAuth();
  const { data: escrows, isLoading: escrowsLoading } = useEscrows();
  const { data: pendingEscrows, isLoading: pendingLoading } = usePendingEscrows();
  const { data: account, isLoading: accountLoading } = useAccount();

  const userId = authData?.user?.id;
  const userOrgId = authData?.user?.primaryOrgId;

  // Mutations
  const acceptEscrow = useAcceptEscrow();
  const cancelEscrow = useCancelEscrow();

  // Separate pending escrows into categories:
  // 1. Assigned specifically to you
  // 2. Assigned to your organization (any member can accept)
  // 3. Open escrows anyone can accept
  const assignedToYou = pendingEscrows?.filter(e => e.partyBUserId === userId) || [];
  const assignedToYourOrg = pendingEscrows?.filter(e =>
    e.partyBOrgId === userOrgId && e.partyBUserId !== userId
  ) || [];
  const openEscrows = pendingEscrows?.filter(e =>
    e.isOpen && !e.partyBUserId && !e.partyBOrgId
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

      // If both checkboxes unchecked, show nothing
      if (!showOriginatedByMe && !showImTheProvider) return false;
      // If both checked, show all
      if (showOriginatedByMe && showImTheProvider) return true;
      // If only "I created" checked
      if (showOriginatedByMe && !showImTheProvider) return isOriginator;
      // If only "I'm the provider" checked
      if (!showOriginatedByMe && showImTheProvider) return isProvider;
      return true;
    });
  };

  // Apply tab filter, then role filter
  const baseEscrows = escrowFilter === 'org' ? orgEscrows : allActiveEscrows;
  const activeEscrows = applyRoleFilter(baseEscrows);

  // Total pending count for notification
  const totalPendingCount = assignedToYou.length + assignedToYourOrg.length + openEscrows.length;

  const handleAccept = async (escrowId: string) => {
    try {
      await acceptEscrow.mutateAsync(escrowId);
      toast({
        title: "Escrow Accepted",
        description: "You have accepted the escrow. It's now pending funding.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept escrow",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (escrowId: string) => {
    // Rejecting just means not accepting - we don't do anything
    toast({
      title: "Rejected",
      description: "You have declined this escrow request.",
    });
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
              You have {totalPendingCount} pending escrow{totalPendingCount > 1 ? 's' : ''} awaiting action
            </AlertTitle>
            <AlertDescription className="text-amber-800 flex items-center justify-between">
              <span>
                {assignedToYou.length > 0 && `${assignedToYou.length} assigned to you`}
                {assignedToYou.length > 0 && assignedToYourOrg.length > 0 && ' • '}
                {assignedToYourOrg.length > 0 && `${assignedToYourOrg.length} for your organization`}
                {(assignedToYou.length > 0 || assignedToYourOrg.length > 0) && openEscrows.length > 0 && ' • '}
                {openEscrows.length > 0 && `${openEscrows.length} open`}
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
                <h1 className="text-2xl font-semibold tracking-tight">Active Escrows</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your secure transactions.</p>
              </div>
              <Link href="/escrow/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New Escrow
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

                {/* Open Escrows Available */}
                {openEscrows.length > 0 && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Open Escrows ({openEscrows.length})
                    </h3>
                    <p className="text-xs text-emerald-700 mb-3">These are open requests that anyone can accept.</p>
                    <div className="space-y-3">
                      {openEscrows.map((escrow) => (
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
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
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
                      All Escrows ({allActiveEscrows.length})
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
                      I created
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="im-the-provider"
                      checked={showImTheProvider}
                      onCheckedChange={(checked) => setShowImTheProvider(checked === true)}
                    />
                    <Label htmlFor="im-the-provider" className="text-sm text-muted-foreground cursor-pointer">
                      I'm the provider
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
                {activeEscrows.map(escrow => (
                  <EscrowCard
                    key={escrow.id}
                    id={escrow.id}
                    serviceType={escrow.serviceTypeId}
                    status={escrow.status}
                    amount={escrow.amount}
                    currency={escrow.currency}
                    partyA={{ name: "You" }} // TODO: Get from API
                    partyB={escrow.partyBUserId ? { name: "Provider" } : null}
                    createdAt={new Date(escrow.createdAt).toLocaleDateString()}
                    expiresAt={escrow.expiresAt ? new Date(escrow.expiresAt).toLocaleDateString() : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="mb-4">No active escrows</p>
                <Link href="/escrow/new">
                  <Button>Create Your First Escrow</Button>
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
                    <Plus className="mr-2 h-4 w-4" /> Create Escrow
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
    </div>
  );
}
