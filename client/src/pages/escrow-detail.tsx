import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { EscrowTimeline } from "@/components/escrow/EscrowTimeline";
import { PartyInfo } from "@/components/escrow/PartyInfo";
import { AttachmentList, type Attachment } from "@/components/attachments/AttachmentList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import {
  useEscrow,
  useEscrowAttachments,
  useAuth,
  useAcceptEscrow,
  useFundEscrow,
  useConfirmEscrow,
  useCancelEscrow,
} from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

const STATUS_BADGES: Record<string, { className: string; label: string }> = {
  CREATED: { className: "bg-slate-100 text-slate-800 border-slate-200", label: "Created" },
  PENDING_ACCEPTANCE: { className: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending Acceptance" },
  PENDING_FUNDING: { className: "bg-blue-100 text-blue-800 border-blue-200", label: "Pending Funding" },
  FUNDED: { className: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Funded" },
  PARTY_B_CONFIRMED: { className: "bg-purple-100 text-purple-800 border-purple-200", label: "Provider Confirmed" },
  PARTY_A_CONFIRMED: { className: "bg-purple-100 text-purple-800 border-purple-200", label: "Buyer Confirmed" },
  COMPLETED: { className: "bg-green-100 text-green-800 border-green-200", label: "Completed" },
  CANCELED: { className: "bg-red-100 text-red-800 border-red-200", label: "Canceled" },
  EXPIRED: { className: "bg-gray-100 text-gray-800 border-gray-200", label: "Expired" },
  DISPUTED: { className: "bg-red-100 text-red-800 border-red-200", label: "Disputed" },
};

export default function EscrowDetail() {
  const { toast } = useToast();
  const [, params] = useRoute("/escrow/:id");
  const id = params?.id || "";

  const { data: authData } = useAuth();
  const { data: escrow, isLoading } = useEscrow(id);
  const { data: attachmentsData } = useEscrowAttachments(id);

  const acceptEscrow = useAcceptEscrow();
  const fundEscrow = useFundEscrow();
  const confirmEscrow = useConfirmEscrow();
  const cancelEscrow = useCancelEscrow();

  const user = authData?.user;
  const isPartyA = escrow?.partyAUserId === user?.id;
  const isPartyB = escrow?.partyBUserId === user?.id;

  // Transform attachments for the list component
  const attachments: Attachment[] = (attachmentsData || []).map(a => ({
    id: a.id,
    name: a.originalFilename || a.filename,
    type: a.mimeType?.includes('pdf') ? 'pdf' : a.mimeType?.includes('image') ? 'image' : 'document',
    size: a.sizeBytes ? `${(a.sizeBytes / 1024).toFixed(1)} KB` : 'Unknown',
    uploadedBy: a.uploadedByUserId === user?.id ? 'You' : `User ${a.uploadedByUserId.slice(0, 8)}`,
    date: new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: a.status === 'RELEASED' ? 'released' : 'locked',
  }));

  const handleAccept = async () => {
    try {
      await acceptEscrow.mutateAsync(id);
      toast({ title: "Escrow accepted", description: "You have accepted this escrow request." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to accept", variant: "destructive" });
    }
  };

  const handleFund = async () => {
    try {
      await fundEscrow.mutateAsync(id);
      toast({ title: "Escrow funded", description: "Funds have been locked in escrow." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fund", variant: "destructive" });
    }
  };

  const handleConfirm = async () => {
    try {
      await confirmEscrow.mutateAsync(id);
      toast({ title: "Confirmed", description: "You have confirmed delivery/receipt." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to confirm", variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelEscrow.mutateAsync({ id, reason: "Canceled by user" });
      toast({ title: "Escrow canceled", description: "The escrow has been canceled." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to cancel", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <Header />
        <PageContainer>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </PageContainer>
      </div>
    );
  }

  if (!escrow) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <Header />
        <PageContainer>
          <div className="text-center py-16">
            <h2 className="text-lg font-semibold mb-2">Escrow not found</h2>
            <p className="text-muted-foreground mb-4">This escrow doesn't exist or you don't have access.</p>
            <Link href="/escrow">
              <Button>Back to Escrows</Button>
            </Link>
          </div>
        </PageContainer>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[escrow.status] || STATUS_BADGES.CREATED;
  const netToSeller = escrow.amount - escrow.platformFee;

  // Determine next action
  const getNextAction = () => {
    switch (escrow.status) {
      case 'CREATED':
      case 'PENDING_ACCEPTANCE':
        return isPartyB
          ? { actor: 'You', action: 'need to accept this escrow request.' }
          : { actor: 'Provider', action: 'needs to accept this escrow request.' };
      case 'PENDING_FUNDING':
        return isPartyA
          ? { actor: 'You', action: 'need to fund the escrow.' }
          : { actor: 'Buyer', action: 'needs to fund the escrow.' };
      case 'FUNDED':
        return isPartyB
          ? { actor: 'You', action: 'need to deliver the service and confirm.' }
          : { actor: 'Provider', action: 'needs to deliver the service.' };
      case 'PARTY_B_CONFIRMED':
        return isPartyA
          ? { actor: 'You', action: 'need to confirm receipt to release funds.' }
          : { actor: 'Buyer', action: 'needs to confirm receipt.' };
      case 'COMPLETED':
        return { actor: 'Complete', action: 'Escrow has been completed successfully.' };
      case 'CANCELED':
        return { actor: 'Canceled', action: 'This escrow was canceled.' };
      default:
        return { actor: 'Waiting', action: 'for next step.' };
    }
  };

  const nextAction = getNextAction();

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <Link href="/escrow">
          <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Escrows
          </Button>
        </Link>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight font-mono">{escrow.id.slice(0, 16)}...</h1>
              <Badge className={statusBadge.className}>
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {escrow.serviceType?.name || escrow.serviceTypeId} • Created on {new Date(escrow.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <MessageSquare className="w-4 h-4" /> Messages
            </Button>
            {(escrow.status === 'FUNDED' || escrow.status === 'PENDING_FUNDING') && (
              <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelEscrow.isPending}>
                {cancelEscrow.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <Card className="mb-8 overflow-hidden">
          <CardContent className="pt-10 pb-8 px-8">
            <EscrowTimeline
              status={escrow.status as any}
              createdAt={new Date(escrow.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            />
          </CardContent>
          <div className="bg-slate-50 border-t p-4 flex items-center gap-3 text-sm text-muted-foreground">
            {escrow.status === 'COMPLETED' ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
            <span>Next Action: <strong className="text-foreground">{nextAction.actor}</strong> {nextAction.action}</span>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">

            {/* Metadata/Description */}
            {escrow.metadata && Object.keys(escrow.metadata).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Agreement Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(escrow.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            <Card>
              <CardHeader>
                <CardTitle>Attachments & Deliverables</CardTitle>
              </CardHeader>
              <CardContent>
                {attachments.length > 0 ? (
                  <AttachmentList attachments={attachments} />
                ) : (
                  <p className="text-sm text-muted-foreground">No attachments yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Action Area */}
            <Card className="border-emerald-100 bg-emerald-50/30">
              <CardHeader>
                <CardTitle className="text-emerald-900">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Accept action for provider */}
                {(escrow.status === 'CREATED' || escrow.status === 'PENDING_ACCEPTANCE') && isPartyB && (
                  <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="space-y-1">
                      <h4 className="font-medium">Accept Escrow</h4>
                      <p className="text-xs text-muted-foreground">Accept this escrow request to proceed.</p>
                    </div>
                    <Button onClick={handleAccept} disabled={acceptEscrow.isPending}>
                      {acceptEscrow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Accept
                    </Button>
                  </div>
                )}

                {/* Fund action for buyer */}
                {escrow.status === 'PENDING_FUNDING' && isPartyA && (
                  <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="space-y-1">
                      <h4 className="font-medium">Fund Escrow</h4>
                      <p className="text-xs text-muted-foreground">Lock funds to proceed with the transaction.</p>
                    </div>
                    <Button onClick={handleFund} disabled={fundEscrow.isPending}>
                      {fundEscrow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Fund ${escrow.amount.toFixed(2)}
                    </Button>
                  </div>
                )}

                {/* Confirm action for provider (Party B) */}
                {escrow.status === 'FUNDED' && isPartyB && (
                  <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="space-y-1">
                      <h4 className="font-medium">Mark as Delivered</h4>
                      <p className="text-xs text-muted-foreground">Confirm you have delivered the service/item.</p>
                    </div>
                    <Button onClick={handleConfirm} disabled={confirmEscrow.isPending}>
                      {confirmEscrow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirm Delivery
                    </Button>
                  </div>
                )}

                {/* Confirm action for buyer (Party A) */}
                {escrow.status === 'PARTY_B_CONFIRMED' && isPartyA && (
                  <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="space-y-1">
                      <h4 className="font-medium">Confirm Receipt</h4>
                      <p className="text-xs text-muted-foreground">Confirm you received the service/item to release funds.</p>
                    </div>
                    <Button onClick={handleConfirm} disabled={confirmEscrow.isPending}>
                      {confirmEscrow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Release Funds
                    </Button>
                  </div>
                )}

                {/* Completed state */}
                {escrow.status === 'COMPLETED' && (
                  <div className="flex items-center gap-3 bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                    <div>
                      <h4 className="font-medium">Escrow Completed</h4>
                      <p className="text-xs text-muted-foreground">Funds have been released to the provider.</p>
                    </div>
                  </div>
                )}

                {/* No action available */}
                {!['CREATED', 'PENDING_ACCEPTANCE', 'PENDING_FUNDING', 'FUNDED', 'PARTY_B_CONFIRMED', 'COMPLETED'].includes(escrow.status) && (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    No actions available for this escrow.
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Amount Card */}
            <Card className="bg-slate-900 text-white border-slate-800">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Escrow Balance</div>
                <div className="text-3xl font-bold font-mono tracking-tight mb-4">
                  ${escrow.amount.toFixed(2)} <span className="text-lg text-slate-500 font-sans">{escrow.currency}</span>
                </div>
                <Separator className="bg-slate-700 my-4" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Platform Fee ({escrow.serviceType?.platformFeePercent || 0}%)</span>
                  <span>${escrow.platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-400">Net to Seller</span>
                  <span className="font-bold text-emerald-400">${netToSeller.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Parties */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider pl-1">Parties Involved</h3>
              <PartyInfo
                role="Buyer"
                name={isPartyA ? 'You' : (escrow.partyA?.displayName || `User ${escrow.partyAUserId.slice(0, 8)}`)}
                email={escrow.partyA?.email || ''}
                isCurrentUser={isPartyA}
                status={escrow.partyAConfirmedAt ? 'confirmed' : 'waiting'}
              />
              <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-slate-100 rounded-full p-1">
                  <ArrowLeft className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                </div>
              </div>
              <PartyInfo
                role="Seller"
                name={escrow.partyBUserId
                  ? (isPartyB ? 'You' : (escrow.partyB?.displayName || `User ${escrow.partyBUserId.slice(0, 8)}`))
                  : 'Pending...'
                }
                email={escrow.partyB?.email || ''}
                isCurrentUser={isPartyB}
                status={escrow.partyBConfirmedAt ? 'confirmed' : (escrow.partyBUserId ? 'action_required' : 'waiting')}
              />
            </div>

          </div>
        </div>
      </PageContainer>
    </div>
  );
}
