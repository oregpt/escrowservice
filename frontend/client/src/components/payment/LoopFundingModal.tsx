/**
 * Loop Funding Modal
 *
 * Modal component for funding account via Loop SDK (Canton wallet).
 * Handles wallet connection and transfer flow.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useLoopWallet, LoopConfig } from '@/hooks/use-loop-wallet';
import { cn } from '@/lib/utils';

// ===== Types =====

interface LoopFundingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  organizationId?: string;
  initialAmount?: string;
}

type FundingStep = 'connect' | 'amount' | 'confirm' | 'processing' | 'success' | 'error';

// ===== Component =====

export function LoopFundingModal({
  open,
  onOpenChange,
  onSuccess,
  initialAmount,
}: LoopFundingModalProps) {
  const loop = useLoopWallet();

  const [step, setStep] = useState<FundingStep>('connect');
  const [amount, setAmount] = useState(initialAmount || '');
  const [ccAmount, setCcAmount] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [config, setConfig] = useState<LoopConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Initialize and check wallet connection when modal opens
  useEffect(() => {
    if (open) {
      loadConfig();
      // Pre-populate amount from dashboard if provided
      if (initialAmount) {
        setAmount(initialAmount);
      }
      if (loop.isConnected) {
        setStep('amount');
      } else {
        setStep('connect');
      }
    }
  }, [open, loop.isConnected, initialAmount]);

  // Load Loop config
  const loadConfig = async () => {
    const cfg = await loop.getConfig();
    setConfig(cfg);
    if (cfg) {
      setExchangeRate(cfg.ccToUsdRate);
    }
  };

  // Calculate CC amount when USD amount changes
  useEffect(() => {
    const calculateCC = async () => {
      const usdAmount = parseFloat(amount);
      if (usdAmount > 0 && exchangeRate && exchangeRate > 0) {
        const cc = (usdAmount / exchangeRate).toFixed(8);
        setCcAmount(cc);
      } else {
        setCcAmount(null);
      }
    };
    calculateCC();
  }, [amount, exchangeRate]);

  // Handle wallet connection
  const handleConnect = async () => {
    try {
      await loop.initialize();
      const provider = await loop.connectAndSave();
      if (provider) {
        setStep('amount');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect wallet');
      setStep('error');
    }
  };

  // Handle amount submission
  const handleAmountSubmit = () => {
    const usdAmount = parseFloat(amount);
    if (usdAmount > 0 && ccAmount) {
      setStep('confirm');
    }
  };

  // Handle funding confirmation
  const handleConfirmFunding = async () => {
    setStep('processing');
    setErrorMessage(null);

    const usdAmount = parseFloat(amount);
    const result = await loop.fundAccount(usdAmount);

    if (result.success) {
      setTransactionId(result.transactionId || null);
      setStep('success');
    } else {
      setErrorMessage(result.error || 'Transfer failed');
      setStep('error');
    }
  };

  // Handle success completion
  const handleComplete = () => {
    onOpenChange(false);
    onSuccess?.();
    // Reset state
    setStep('connect');
    setAmount('');
    setCcAmount(null);
    setErrorMessage(null);
    setTransactionId(null);
  };

  // Handle retry from error
  const handleRetry = () => {
    setErrorMessage(null);
    if (loop.isConnected) {
      setStep('amount');
    } else {
      setStep('connect');
    }
  };

  // Refresh exchange rate
  const refreshRate = async () => {
    const rate = await loop.getExchangeRate();
    if (rate) {
      setExchangeRate(rate);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Fund with Canton Wallet
          </DialogTitle>
          <DialogDescription>
            {step === 'connect' && 'Connect your Loop wallet to continue'}
            {step === 'amount' && 'Enter the amount you want to deposit'}
            {step === 'confirm' && 'Review and confirm your transfer'}
            {step === 'processing' && 'Processing your transfer...'}
            {step === 'success' && 'Your account has been funded!'}
            {step === 'error' && 'Something went wrong'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step: Connect Wallet */}
          {step === 'connect' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Connect your Canton wallet using the Loop SDK
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleConnect}
                disabled={loop.isConnecting}
              >
                {loop.isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </>
                )}
              </Button>

              {loop.sdkError && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{loop.sdkError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step: Enter Amount */}
          {step === 'amount' && (
            <div className="space-y-4">
              {/* Connected wallet info */}
              {loop.provider && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Wallet Connected</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1 font-mono truncate">
                    {loop.provider.party_id.slice(0, 20)}...
                  </p>
                </div>
              )}

              {/* Amount input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    placeholder="0.00"
                    className="pl-7 font-mono text-lg"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* CC equivalent */}
              {ccAmount && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">You will send</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-semibold">{ccAmount}</span>
                      <Badge variant="secondary">CC</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>Rate: 1 CC = ${exchangeRate?.toFixed(4) || '—'} USD</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={refreshRate}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleAmountSubmit}
                disabled={!amount || parseFloat(amount) <= 0 || !ccAmount}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-mono font-semibold">${amount} USD</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">CC Amount</span>
                  <span className="font-mono font-semibold">{ccAmount} CC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Exchange Rate</span>
                  <span className="text-sm">1 CC = ${exchangeRate?.toFixed(4)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">To Platform</span>
                    <span className="text-xs font-mono truncate max-w-[180px]">
                      {config?.platformPartyId.slice(0, 16)}...
                    </span>
                  </div>
                </div>
              </div>

              <Alert>
                <Wallet className="h-4 w-4" />
                <AlertDescription>
                  You will be asked to confirm this transfer in your Loop wallet.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('amount')}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmFunding}
                >
                  Confirm & Transfer
                </Button>
              </div>
            </div>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="py-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center">
                  Processing your transfer...
                  <br />
                  Please confirm in your wallet if prompted.
                </p>
              </div>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-lg">Transfer Complete!</h3>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  ${amount} USD has been deposited to your account.
                </p>
              </div>

              {transactionId && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Transaction ID</p>
                  <p className="font-mono text-xs truncate">{transactionId}</p>
                </div>
              )}

              <Button className="w-full" onClick={handleComplete}>
                Done
              </Button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="font-semibold text-lg">Transfer Failed</h3>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  {errorMessage || 'An unexpected error occurred'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleRetry}>
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Network indicator */}
        {config && step !== 'success' && step !== 'error' && (
          <div className="border-t pt-3 flex items-center justify-center gap-2">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                config.network === 'mainnet' ? 'bg-green-500' : 'bg-yellow-500'
              )}
            />
            <span className="text-xs text-muted-foreground capitalize">
              {config.network} Network
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
