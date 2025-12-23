import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Shield, Globe, Loader2, CheckCircle, DollarSign, XCircle, Zap, Link as LinkIcon } from "lucide-react";
import type { EscrowCardProps } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfirmationFormModal, type ConfirmationStep } from "./ConfirmationFormModal";
import { TokenizeModal } from "./TokenizeModal";
import { useTrafficPurchaseStatus, useTokenizationStatus } from "@/hooks/use-api";

const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-slate-100 text-slate-700 border-slate-200",
  PENDING: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING_ACCEPTANCE: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING_FUNDING: "bg-amber-50 text-amber-700 border-amber-200",
  FUNDED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTY_B_CONFIRMED: "bg-purple-50 text-purple-700 border-purple-200",
  PARTY_A_CONFIRMED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  COMPLETED: "bg-slate-900 text-white border-slate-900",
  CANCELED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-stone-50 text-stone-700 border-stone-200",
  DISPUTED: "bg-orange-50 text-orange-700 border-orange-200",
};

// Extended props to support modal-based actions
interface EscrowCardWithModalProps extends EscrowCardProps {
  // Enhanced handlers that receive modal data
  onFundWithData?: (data: { notes: string; file?: File; holdUntilCompletion: boolean }) => Promise<void>;
  onConfirmWithData?: (data: { notes: string; file?: File; holdUntilCompletion: boolean }) => Promise<void>;
  // Determine which confirm step this is (for modal title)
  confirmStep?: 'PARTY_B_CONFIRM' | 'PARTY_A_CONFIRM';
  // Execute Traffic Purchase action (for TRAFFIC_BUY escrows)
  canExecuteTraffic?: boolean;
  onExecuteTraffic?: () => void;
  isExecutingTraffic?: boolean;
  // Service type ID - needed for traffic purchase status check
  serviceTypeId?: string;
  // Tokenization - show when feature flag is enabled and status is eligible
  canTokenize?: boolean;
}

export function EscrowCard({
  id,
  serviceType,
  status,
  amount,
  currency,
  partyA,
  partyB,
  createdAt,
  expiresAt,
  title,
  isOpen,
  canAccept,
  onAccept,
  isAccepting,
  canFund,
  onFund,
  onFundWithData,
  isFunding,
  canConfirm,
  onConfirm,
  onConfirmWithData,
  isConfirming,
  confirmStep,
  canCancel,
  onCancel,
  isCanceling,
  canExecuteTraffic,
  onExecuteTraffic,
  isExecutingTraffic,
  serviceTypeId,
  canTokenize,
}: EscrowCardWithModalProps) {
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ConfirmationStep | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenizeModalOpen, setTokenizeModalOpen] = useState(false);

  // Check traffic purchase status for TRAFFIC_BUY escrows
  const { data: trafficPurchaseStatus } = useTrafficPurchaseStatus(id, serviceTypeId);
  const trafficAlreadyExecuted = trafficPurchaseStatus?.successful;

  // Check tokenization status
  const { data: tokenizationStatus } = useTokenizationStatus(canTokenize ? id : undefined);
  const isTokenized = tokenizationStatus?.isTokenized;

  // Determine if any action is available
  const hasActions = canAccept || canFund || canConfirm || canCancel;

  // Handle Fund button click - open modal
  const handleFundClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onFundWithData) {
      setModalStep('FUNDING');
      setModalOpen(true);
    } else if (onFund) {
      onFund();
    }
  };

  // Handle Confirm button click - open modal
  const handleConfirmClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onConfirmWithData) {
      // Determine confirm step based on status
      const step = confirmStep || (status === 'FUNDED' ? 'PARTY_B_CONFIRM' : 'PARTY_A_CONFIRM');
      setModalStep(step);
      setModalOpen(true);
    } else if (onConfirm) {
      onConfirm();
    }
  };

  // Handle modal submission
  const handleModalSubmit = async (data: { notes: string; file?: File; holdUntilCompletion: boolean }) => {
    setIsSubmitting(true);
    try {
      if (modalStep === 'FUNDING' && onFundWithData) {
        await onFundWithData(data);
      } else if ((modalStep === 'PARTY_B_CONFIRM' || modalStep === 'PARTY_A_CONFIRM') && onConfirmWithData) {
        await onConfirmWithData(data);
      }
      setModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-primary/10 hover:border-l-primary/40">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                <Shield className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm tracking-tight">{title || serviceType}</h3>
                <p className="text-xs text-muted-foreground font-mono">#{id.substring(0, 8)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOpen && (
                <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs font-medium border border-green-200 bg-green-50 text-green-700">
                  <Globe className="h-3 w-3 mr-1" />
                  Open
                </Badge>
              )}
              <Badge variant="outline" className={cn("rounded-md px-2.5 py-0.5 text-xs font-medium border", STATUS_COLORS[status] || STATUS_COLORS.CREATED)}>
                {status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-2xl font-bold font-mono tracking-tight">
              ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-sans text-muted-foreground font-normal">{currency}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm mb-6 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground mb-1">Originator</span>
              <span className="font-medium">{partyA.name}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground mb-1">Counterparty</span>
              <span className="font-medium text-right">{partyB?.name || "Pending..."}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              <span>Expires {expiresAt || "Never"}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Cancel button - show first as secondary action */}
              {canCancel && onCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={(e) => {
                    e.preventDefault();
                    onCancel();
                  }}
                  disabled={isCanceling}
                >
                  {isCanceling ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  Cancel
                </Button>
              )}
              {/* Accept button */}
              {canAccept && onAccept && (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={(e) => {
                    e.preventDefault();
                    onAccept();
                  }}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  Accept
                </Button>
              )}
              {/* Fund button - opens modal */}
              {canFund && (onFund || onFundWithData) && (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700"
                  onClick={handleFundClick}
                  disabled={isFunding}
                >
                  {isFunding ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <DollarSign className="h-3 w-3 mr-1" />
                  )}
                  Fund
                </Button>
              )}
              {/* Confirm button - opens modal */}
              {canConfirm && (onConfirm || onConfirmWithData) && (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={handleConfirmClick}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  Confirm
                </Button>
              )}
              {/* Execute Purchase button - for TRAFFIC_BUY escrows */}
              {canExecuteTraffic && onExecuteTraffic && (
                trafficAlreadyExecuted ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-emerald-200 text-emerald-700"
                    disabled
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Executed
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-purple-600 hover:bg-purple-700"
                    onClick={(e) => {
                      e.preventDefault();
                      onExecuteTraffic();
                    }}
                    disabled={isExecutingTraffic}
                  >
                    {isExecutingTraffic ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    Execute Purchase
                  </Button>
                )
              )}
              {/* Tokenize button - when feature flag enabled and status is eligible */}
              {canTokenize && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-8 text-xs",
                    isTokenized
                      ? "border-blue-200 text-blue-700 hover:bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    setTokenizeModalOpen(true);
                  }}
                >
                  <LinkIcon className="h-3 w-3 mr-1" />
                  {isTokenized ? "Update Token" : "Tokenize"}
                </Button>
              )}
              <Link href={`/escrow/${id}`}>
                <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-slate-100 hover:text-slate-900 group">
                  View Details
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      {modalStep && (
        <ConfirmationFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          step={modalStep}
          escrowId={id}
          amount={amount}
          currency={currency}
          onSubmit={handleModalSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Tokenize Modal */}
      {canTokenize && (
        <TokenizeModal
          escrow={{
            id,
            serviceTypeId: (serviceTypeId || serviceType) as any,
            status: status as any,
            amount,
            currency,
            title,
            partyAOrgId: '',
            createdByUserId: '',
            isOpen: isOpen || false,
            privacyLevel: 'platform',
            arbiterType: 'platform_only',
            platformFee: 0,
            createdAt: createdAt || '',
            updatedAt: '',
          }}
          open={tokenizeModalOpen}
          onOpenChange={setTokenizeModalOpen}
        />
      )}
    </>
  );
}
