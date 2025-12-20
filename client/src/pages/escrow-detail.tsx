import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { EscrowTimeline } from "@/components/escrow/EscrowTimeline";
import { PartyInfo } from "@/components/escrow/PartyInfo";
import { AttachmentList, type Attachment } from "@/components/attachments/AttachmentList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, AlertCircle, CheckCircle, Loader2, XCircle, Globe, Users, Lock, Scale, Gavel, Shield, Building, Clock, FileCheck } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";
import {
  useEscrow,
  useEscrowAttachments,
  useEscrowMessages,
  useAddMessage,
  useAuth,
  useAcceptEscrow,
  useFundEscrow,
  useConfirmEscrow,
  useCancelEscrow,
} from "@/hooks/use-api";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { arbiter as arbiterApi, type Obligation } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_BADGES: Record<string, { className: string; label: string }> = {
  CREATED: { className: "bg-slate-100 text-slate-800 border-slate-200", label: "Created" },
  PENDING_ACCEPTANCE: { className: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending Acceptance" },
  PENDING_FUNDING: { className: "bg-blue-100 text-blue-800 border-blue-200", label: "Pending Funding" },
  FUNDED: { className: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Funded" },
  PARTY_B_CONFIRMED: { className: "bg-purple-100 text-purple-800 border-purple-200", label: "Counterparty Confirmed" },
  PARTY_A_CONFIRMED: { className: "bg-purple-100 text-purple-800 border-purple-200", label: "Originator Confirmed" },
  COMPLETED: { className: "bg-green-100 text-green-800 border-green-200", label: "Completed" },
  CANCELED: { className: "bg-red-100 text-red-800 border-red-200", label: "Canceled" },
  EXPIRED: { className: "bg-gray-100 text-gray-800 border-gray-200", label: "Expired" },
  DISPUTED: { className: "bg-red-100 text-red-800 border-red-200", label: "Disputed" },
};

const PRIVACY_BADGES: Record<string, { className: string; label: string; icon: typeof Globe }> = {
  public: { className: "bg-sky-50 text-sky-700 border-sky-200", label: "Public", icon: Globe },
  platform: { className: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "Platform", icon: Users },
  private: { className: "bg-slate-100 text-slate-700 border-slate-300", label: "Private", icon: Lock },
};

export default function EscrowDetail() {
  const { toast } = useToast();
  const [, params] = useRoute("/escrow/:id");
  const id = params?.id || "";

  const { data: authData } = useAuth();
  const { data: escrow, isLoading } = useEscrow(id);
  const { data: attachmentsData } = useEscrowAttachments(id);
  const { data: messages } = useEscrowMessages(id);
  const addMessage = useAddMessage();

  const [newMessage, setNewMessage] = useState('');
  const [arbiterCancelOpen, setArbiterCancelOpen] = useState(false);
  const [arbiterForceCompleteOpen, setArbiterForceCompleteOpen] = useState(false);
  const [arbiterReason, setArbiterReason] = useState('');
  const queryClient = useQueryClient();

  const acceptEscrow = useAcceptEscrow();
  const fundEscrow = useFundEscrow();
  const confirmEscrow = useConfirmEscrow();
  const cancelEscrow = useCancelEscrow();

  // Check if current user is arbiter for this escrow
  const { data: arbiterCheck } = useQuery({
    queryKey: ['arbiter-check', id],
    queryFn: async () => {
      const res = await arbiterApi.isArbiter(id);
      return res.data;
    },
    enabled: !!id && !!user,
  });
  const isArbiter = arbiterCheck?.isArbiter || false;

  // Arbiter cancel mutation
  const arbiterCancelMutation = useMutation({
    mutationFn: async ({ reason, refundToPartyA }: { reason: string; refundToPartyA: boolean }) => {
      return arbiterApi.cancelEscrow(id, reason, refundToPartyA);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      setArbiterCancelOpen(false);
      setArbiterReason('');
      toast({ title: "Escrow Canceled", description: "The escrow has been canceled by arbiter." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to cancel", variant: "destructive" });
    },
  });

  // Arbiter force complete mutation
  const arbiterForceCompleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      return arbiterApi.forceComplete(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escrow', id] });
      setArbiterForceCompleteOpen(false);
      setArbiterReason('');
      toast({ title: "Escrow Completed", description: "Funds have been released to the provider by arbiter." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to complete", variant: "destructive" });
    },
  });

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

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addMessage.mutateAsync({ escrowId: id, message: newMessage.trim() });
      setNewMessage('');
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to send message", variant: "destructive" });
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
  const privacyBadge = PRIVACY_BADGES[escrow.privacyLevel || 'platform'];
  const PrivacyIcon = privacyBadge?.icon || Users;
  const netToCounterparty = escrow.amount - escrow.platformFee;

  // Determine next action
  const getNextAction = () => {
    switch (escrow.status) {
      case 'CREATED':
      case 'PENDING_ACCEPTANCE':
        return isPartyB
          ? { actor: 'You', action: 'need to accept this escrow request.' }
          : { actor: 'Counterparty', action: 'needs to accept this escrow request.' };
      case 'PENDING_FUNDING':
        return isPartyA
          ? { actor: 'You', action: 'need to fund the escrow.' }
          : { actor: 'Originator', action: 'needs to fund the escrow.' };
      case 'FUNDED':
        return isPartyB
          ? { actor: 'You', action: 'need to deliver the service and confirm.' }
          : { actor: 'Counterparty', action: 'needs to deliver the service.' };
      case 'PARTY_B_CONFIRMED':
        return isPartyA
          ? { actor: 'You', action: 'need to confirm receipt to release funds.' }
          : { actor: 'Originator', action: 'needs to confirm receipt.' };
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
              {privacyBadge && (
                <Badge variant="outline" className={`${privacyBadge.className} gap-1`}>
                  <PrivacyIcon className="h-3 w-3" />
                  {privacyBadge.label}
                </Badge>
              )}
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

            {/* Obligations Progress */}
            {escrow.metadata?.obligations && Array.isArray(escrow.metadata.obligations) && (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" />
                    Obligations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(escrow.metadata.obligations as Obligation[]).map((obligation) => {
                    const isComplete = obligation.status === 'completed';
                    const isDisputed = obligation.status === 'disputed';
                    const partyLabel = obligation.party === 'A' ? 'Party A (Originator)' : 'Party B (Counterparty)';

                    return (
                      <div
                        key={obligation.id}
                        className={`rounded-lg border p-4 ${
                          isComplete
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : isDisputed
                              ? 'bg-red-50/50 border-red-200'
                              : 'bg-slate-50/50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 rounded-full p-1.5 ${
                              isComplete
                                ? 'bg-emerald-100 text-emerald-600'
                                : isDisputed
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-slate-200 text-slate-500'
                            }`}>
                              {isComplete ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : isDisputed ? (
                                <AlertCircle className="h-4 w-4" />
                              ) : (
                                <Clock className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  {partyLabel}
                                </span>
                                <Badge variant="outline" className={`text-xs ${
                                  isComplete
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : isDisputed
                                      ? 'bg-red-100 text-red-700 border-red-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {isComplete ? 'Complete' : isDisputed ? 'Disputed' : 'Pending'}
                                </Badge>
                              </div>
                              <p className="font-medium mt-1">{obligation.description}</p>
                              {obligation.completedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Completed: {new Date(obligation.completedAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                              )}
                              {obligation.evidenceAttachmentIds && obligation.evidenceAttachmentIds.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Evidence: {obligation.evidenceAttachmentIds.length} attachment(s)
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Metadata/Description (excluding obligations) */}
            {escrow.metadata && Object.keys(escrow.metadata).filter(k => k !== 'obligations').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Agreement Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Object.entries(escrow.metadata)
                      .filter(([key]) => key !== 'obligations')
                      .map(([key, value]) => (
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

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Messages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Message List */}
                <div className="max-h-80 overflow-y-auto space-y-3">
                  {messages && messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.userId === user?.id ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="text-xs">
                            {msg.user?.displayName?.[0]?.toUpperCase() || msg.user?.username?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex flex-col max-w-[80%] ${msg.userId === user?.id ? 'items-end' : ''}`}>
                          <div className={`rounded-lg px-3 py-2 text-sm ${
                            msg.isSystemMessage
                              ? 'bg-slate-100 text-slate-600 italic'
                              : msg.userId === user?.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                          }`}>
                            {msg.message}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">
                            {msg.user?.displayName || msg.user?.username || 'User'} •{' '}
                            {new Date(msg.createdAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No messages yet. Start the conversation!
                    </p>
                  )}
                </div>

                {/* Message Input */}
                {user?.isAuthenticated ? (
                  <div className="flex gap-2 pt-2 border-t">
                    <Textarea
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[60px] resize-none"
                      disabled={addMessage.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={addMessage.isPending || !newMessage.trim()}
                      size="icon"
                      className="h-auto aspect-square"
                    >
                      {addMessage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="pt-2 border-t text-center">
                    <p className="text-sm text-muted-foreground">
                      Sign in to send messages
                    </p>
                  </div>
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

                {/* Arbiter Actions (only shown for funded escrows when user is arbiter) */}
                {isArbiter && ['FUNDED', 'PARTY_B_CONFIRMED', 'PARTY_A_CONFIRMED'].includes(escrow.status) && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Scale className="h-4 w-4 text-amber-600" />
                      <h4 className="font-medium text-sm">Arbiter Actions</h4>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setArbiterReason('');
                          setArbiterCancelOpen(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel & Refund
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          setArbiterReason('');
                          setArbiterForceCompleteOpen(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Force Release
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use these actions only to resolve disputes between parties.
                    </p>
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
                  <span className="text-slate-400">Net to Counterparty</span>
                  <span className="font-bold text-emerald-400">${netToCounterparty.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Parties */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider pl-1">Parties Involved</h3>
              <PartyInfo
                role="Originator"
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
                role="Counterparty"
                name={escrow.partyBUserId
                  ? (isPartyB ? 'You' : (escrow.partyB?.displayName || `User ${escrow.partyBUserId.slice(0, 8)}`))
                  : 'Pending...'
                }
                email={escrow.partyB?.email || ''}
                isCurrentUser={isPartyB}
                status={escrow.partyBConfirmedAt ? 'confirmed' : (escrow.partyBUserId ? 'action_required' : 'waiting')}
              />
            </div>

            {/* Arbiter / Dispute Resolution Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-600" />
                  Dispute Resolution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {escrow.arbiterType === 'platform_only' && (
                    <>
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span>Platform</span>
                    </>
                  )}
                  {escrow.arbiterType === 'organization' && (
                    <>
                      <Building className="h-4 w-4 text-purple-600" />
                      <span>
                        {escrow.arbiterOrg?.name || (escrow.arbiterOrgId ? `Org ${escrow.arbiterOrgId.slice(0, 8)}...` : 'Organization')}
                      </span>
                    </>
                  )}
                  {escrow.arbiterType === 'person' && (
                    <>
                      <Gavel className="h-4 w-4 text-amber-600" />
                      <span>
                        {escrow.arbiter?.displayName || escrow.arbiterEmail || 'Specific Person'}
                      </span>
                    </>
                  )}
                </div>
                {isArbiter && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    You are the arbiter
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground">
                  {escrow.arbiterType === 'platform_only'
                    ? 'Platform admin handles disputes.'
                    : 'Platform always retains override ability.'}
                </p>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Arbiter Cancel Dialog */}
        <Dialog open={arbiterCancelOpen} onOpenChange={setArbiterCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-amber-600" />
                Cancel Escrow (Arbiter)
              </DialogTitle>
              <DialogDescription>
                As the arbiter, you can cancel this escrow and refund the funds. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Reason for cancellation <span className="text-red-500">*</span></Label>
                <Textarea
                  id="cancel-reason"
                  placeholder="Explain why this escrow is being canceled..."
                  value={arbiterReason}
                  onChange={(e) => setArbiterReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-amber-900">Funds will be refunded to the originator (Party A).</p>
                <p className="text-amber-700 mt-1">Amount: ${escrow.amount.toFixed(2)}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setArbiterCancelOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => arbiterCancelMutation.mutate({ reason: arbiterReason, refundToPartyA: true })}
                disabled={!arbiterReason.trim() || arbiterCancelMutation.isPending}
              >
                {arbiterCancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel Escrow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Arbiter Force Complete Dialog */}
        <Dialog open={arbiterForceCompleteOpen} onOpenChange={setArbiterForceCompleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-emerald-600" />
                Force Release Funds (Arbiter)
              </DialogTitle>
              <DialogDescription>
                As the arbiter, you can force release funds to the provider. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="complete-reason">Reason for force completion <span className="text-red-500">*</span></Label>
                <Textarea
                  id="complete-reason"
                  placeholder="Explain why funds are being released..."
                  value={arbiterReason}
                  onChange={(e) => setArbiterReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-emerald-900">Funds will be released to the provider (Party B).</p>
                <p className="text-emerald-700 mt-1">Net amount: ${(escrow.amount - escrow.platformFee).toFixed(2)}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setArbiterForceCompleteOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => arbiterForceCompleteMutation.mutate(arbiterReason)}
                disabled={!arbiterReason.trim() || arbiterForceCompleteMutation.isPending}
              >
                {arbiterForceCompleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Release Funds
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </div>
  );
}
