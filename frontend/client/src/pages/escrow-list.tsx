import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { EscrowCard } from "@/components/escrow/EscrowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Plus, Search, Filter, Loader2 } from "lucide-react";
import { useState } from "react";
import { useEscrows, useAuth, useAcceptEscrow, useFundEscrow, useConfirmEscrow, useCancelEscrow, useUploadAttachment } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

export default function EscrowList() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const { data: authData } = useAuth();
  const { data: escrows, isLoading } = useEscrows(statusFilter === "all" ? undefined : statusFilter);
  const acceptEscrow = useAcceptEscrow();
  const fundEscrow = useFundEscrow();
  const confirmEscrow = useConfirmEscrow();
  const cancelEscrow = useCancelEscrow();
  const uploadAttachment = useUploadAttachment();

  const user = authData?.user;
  const isAuthenticated = user?.isAuthenticated;

  // Filter escrows by search query
  const filteredEscrows = escrows?.filter(escrow => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      escrow.id.toLowerCase().includes(query) ||
      escrow.serviceTypeId.toLowerCase().includes(query) ||
      (escrow.title && escrow.title.toLowerCase().includes(query))
    );
  }) || [];

  // Handle accepting an escrow
  const handleAccept = async (escrowId: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to accept this deal.",
        variant: "destructive",
      });
      return;
    }

    setAcceptingId(escrowId);
    try {
      await acceptEscrow.mutateAsync(escrowId);
      toast({
        title: "Deal accepted!",
        description: "You are now the provider for this deal.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to accept deal",
        variant: "destructive",
      });
    } finally {
      setAcceptingId(null);
    }
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

  // Transform escrow data for the card component
  const transformEscrow = (escrow: typeof escrows[0]) => {
    const isCreator = escrow.partyAUserId === user?.id;
    const isProvider = escrow.partyBUserId === user?.id;
    const isOpenOffer = escrow.status === 'PENDING' && !escrow.partyBUserId;

    // Determine available actions based on status and role
    // Can accept if: pending status, not the creator, and (is assigned provider OR open offer)
    const canAccept = (escrow.status === 'PENDING' || escrow.status === 'PENDING_ACCEPTANCE') &&
      !isCreator &&
      (isProvider || isOpenOffer || escrow.isOpen) &&
      isAuthenticated;

    // Can fund if: PENDING_FUNDING and user is partyA
    const canFund = escrow.status === 'PENDING_FUNDING' && isCreator && isAuthenticated;

    // Can confirm if: FUNDED and user is partyB, or PARTY_B_CONFIRMED and user is partyA
    const canConfirm = isAuthenticated && (
      (escrow.status === 'FUNDED' && isProvider) ||
      (escrow.status === 'PARTY_B_CONFIRMED' && isCreator)
    );

    // Can cancel if: creator and ONLY before partyB accepts (PENDING status)
    // Once accepted/funded, only platform arbiter can cancel
    const canCancel = isCreator && escrow.status === 'PENDING' && isAuthenticated;

    // Determine confirm step based on status
    const confirmStep = escrow.status === 'FUNDED' ? 'PARTY_B_CONFIRM' : 'PARTY_A_CONFIRM';

    return {
      id: escrow.id,
      serviceType: escrow.serviceTypeId as "TRAFFIC_BUY" | "DOCUMENT_DELIVERY" | "API_KEY_EXCHANGE" | "CUSTOM",
      status: escrow.status as "CREATED" | "PENDING_ACCEPTANCE" | "PENDING_FUNDING" | "FUNDED" | "PARTY_B_CONFIRMED" | "PARTY_A_CONFIRMED" | "COMPLETED" | "CANCELED" | "EXPIRED" | "DISPUTED",
      amount: escrow.amount,
      currency: escrow.currency,
      partyA: { name: isCreator ? 'You' : `User ${escrow.partyAUserId.slice(0, 8)}` },
      partyB: escrow.partyBUserId
        ? { name: isProvider ? 'You' : `User ${escrow.partyBUserId.slice(0, 8)}` }
        : null,
      createdAt: new Date(escrow.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      expiresAt: escrow.expiresAt
        ? new Date(escrow.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : undefined,
      title: escrow.title,
      isOpen: escrow.isOpen || isOpenOffer,
      canAccept,
      onAccept: () => handleAccept(escrow.id),
      isAccepting: acceptingId === escrow.id,
      canFund,
      onFund: () => handleFund(escrow.id),
      onFundWithData: (data: { notes: string; file?: File; holdUntilCompletion: boolean }) =>
        handleFundWithData(escrow.id, data),
      isFunding: fundEscrow.isPending || uploadAttachment.isPending,
      canConfirm,
      onConfirm: () => handleConfirm(escrow.id),
      onConfirmWithData: (data: { notes: string; file?: File; holdUntilCompletion: boolean }) =>
        handleConfirmWithData(escrow.id, confirmStep, data),
      confirmStep: confirmStep as 'PARTY_B_CONFIRM' | 'PARTY_A_CONFIRM',
      isConfirming: confirmEscrow.isPending || uploadAttachment.isPending,
      canCancel,
      onCancel: () => handleCancel(escrow.id),
      isCanceling: cancelEscrow.isPending,
    };
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isAuthenticated ? 'All Deals' : 'Browse Deals'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAuthenticated
                ? 'View and manage all your transactions.'
                : 'View open deals available for acceptance.'}
            </p>
          </div>
          {isAuthenticated && (
            <Link href="/escrow/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Deal
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID or service type..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="CREATED">Created</SelectItem>
              <SelectItem value="PENDING_ACCEPTANCE">Pending Acceptance</SelectItem>
              <SelectItem value="PENDING_FUNDING">Pending Funding</SelectItem>
              <SelectItem value="FUNDED">Funded</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELED">Canceled</SelectItem>
              <SelectItem value="DISPUTED">Disputed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEscrows.length > 0 ? (
          <div className="grid gap-4">
            {filteredEscrows.map(escrow => (
              <EscrowCard key={escrow.id} {...transformEscrow(escrow)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">
              {isAuthenticated ? 'No deals found' : 'No open deals available'}
            </p>
            {isAuthenticated && (
              <Link href="/escrow/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Create your first deal
                </Button>
              </Link>
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}
