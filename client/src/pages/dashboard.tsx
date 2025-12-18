import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSummary } from "@/components/account/AccountSummary";
import { EscrowCard } from "@/components/escrow/EscrowCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Loader2 } from "lucide-react";
import { useEscrows, usePendingEscrows, useAccount, useAcceptEscrow, useCancelEscrow } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();

  // Fetch data from API
  const { data: escrows, isLoading: escrowsLoading } = useEscrows();
  const { data: pendingEscrows, isLoading: pendingLoading } = usePendingEscrows();
  const { data: account, isLoading: accountLoading } = useAccount();

  // Mutations
  const acceptEscrow = useAcceptEscrow();
  const cancelEscrow = useCancelEscrow();

  // Filter active escrows (not completed/canceled)
  const activeEscrows = escrows?.filter(e =>
    !['COMPLETED', 'CANCELED', 'EXPIRED'].includes(e.status)
  ) || [];

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
            {pendingLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingEscrows && pendingEscrows.length > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  Pending Your Acceptance ({pendingEscrows.length})
                </h3>
                <div className="space-y-3">
                  {pendingEscrows.map((escrow) => (
                    <div key={escrow.id} className="bg-white p-3 rounded border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-sm">{escrow.serviceTypeId.replace('_', ' ')}</div>
                        <div className="text-xs text-muted-foreground">
                          ${escrow.amount.toFixed(2)} {escrow.currency}
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
                            "Accept"
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
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
                    View Account & Ledger
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline" className="w-full justify-start">
                    Auto-Accept Settings
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
