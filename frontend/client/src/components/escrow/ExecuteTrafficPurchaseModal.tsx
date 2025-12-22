import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, Zap, Copy, ExternalLink } from 'lucide-react';
import { useExecuteTrafficPurchase, useTrafficConfig } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import type { EscrowWithParties, TrafficPurchaseResponse } from '@/lib/api';

interface ExecuteTrafficPurchaseModalProps {
  escrow: EscrowWithParties;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecuteTrafficPurchaseModal({ escrow, open, onOpenChange }: ExecuteTrafficPurchaseModalProps) {
  const { toast } = useToast();
  const [bearerToken, setBearerToken] = useState('');
  const [result, setResult] = useState<TrafficPurchaseResponse | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { data: trafficConfig, isLoading: configLoading } = useTrafficConfig();
  const executeTrafficPurchase = useExecuteTrafficPurchase();

  const validatorPartyId = escrow.metadata?.validatorPartyId as string | undefined;
  const trafficAmountBytes = escrow.metadata?.trafficAmountBytes as number | undefined;

  const formatBytes = (bytes: number) => {
    if (bytes >= 1_000_000_000) {
      return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
    } else if (bytes >= 1_000_000) {
      return `${(bytes / 1_000_000).toFixed(2)} MB`;
    } else if (bytes >= 1_000) {
      return `${(bytes / 1_000).toFixed(2)} KB`;
    }
    return `${bytes} bytes`;
  };

  const handleShowConfirmation = () => {
    if (!bearerToken.trim()) {
      toast({ title: 'Error', description: 'Bearer token is required', variant: 'destructive' });
      return;
    }
    setShowConfirmation(true);
  };

  const handleExecute = async () => {
    try {
      const response = await executeTrafficPurchase.mutateAsync({
        escrowId: escrow.id,
        bearerToken: bearerToken.trim(),
      });
      setResult(response);
      setBearerToken(''); // Clear token immediately after use
      setShowConfirmation(false);

      if (response.success) {
        toast({ title: 'Success', description: 'Traffic purchase executed successfully' });
      }
    } catch (error: any) {
      // Extract detailed error message
      let errorMessage = 'Failed to execute traffic purchase';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Log full error for debugging
      console.error('[ExecuteTrafficPurchase] Full error:', error);

      // Show error in result view for more visibility
      setResult({
        success: false,
        error: errorMessage,
      });

      toast({
        title: 'Execution Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setShowConfirmation(false);
    }
  };

  const handleClose = () => {
    setBearerToken('');
    setResult(null);
    setShowConfirmation(false);
    onOpenChange(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  const hasConfig = trafficConfig && trafficConfig.walletValidatorUrl && trafficConfig.domainId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Execute Traffic Purchase
          </DialogTitle>
          <DialogDescription>
            Purchase Canton Network traffic for the receiving validator.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          // Show result after execution
          <div className="space-y-4 py-4">
            {result.success ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">Traffic Purchase Successful</span>
                </div>

                {result.trackingId && (
                  <div className="space-y-2">
                    <Label className="text-xs text-emerald-700">Tracking ID</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 rounded border border-emerald-200 text-sm font-mono break-all">
                        {result.trackingId}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => copyToClipboard(result.trackingId!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {result.response && Object.keys(result.response).length > 0 && (
                  <div className="mt-4">
                    <Label className="text-xs text-emerald-700">Response Details</Label>
                    <pre className="mt-2 bg-white p-3 rounded border border-emerald-200 text-xs overflow-auto max-h-48">
                      {JSON.stringify(result.response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-900">Execution Failed</span>
                </div>
                <p className="text-sm text-red-700">{result.error || 'Unknown error occurred'}</p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          // Show form before execution
          <div className="space-y-4 py-4">
            {/* Traffic Details */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Traffic Purchase Details</h4>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Traffic Amount</Label>
                  <p className="font-mono font-medium">
                    {trafficAmountBytes ? formatBytes(trafficAmountBytes) : 'Not specified'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Escrow Amount</Label>
                  <p className="font-mono font-medium">${escrow.amount.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Receiving Validator Party ID</Label>
                <p className="font-mono text-xs break-all bg-white px-2 py-1 rounded border mt-1">
                  {validatorPartyId || 'Not specified'}
                </p>
              </div>
            </div>

            {/* User Config */}
            {configLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : hasConfig ? (
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-blue-900">Your Traffic Configuration</h4>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Configured</Badge>
                </div>

                <div className="text-sm space-y-2">
                  <div>
                    <Label className="text-xs text-blue-700">Wallet Validator URL</Label>
                    <p className="font-mono text-xs break-all">{trafficConfig.walletValidatorUrl}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-blue-700">Domain ID</Label>
                    <p className="font-mono text-xs break-all">{trafficConfig.domainId}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-amber-900">Configuration Required</span>
                </div>
                <p className="text-sm text-amber-700">
                  Please configure your traffic settings (Wallet URL and Domain ID) before executing purchases.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    handleClose();
                    // Navigate to settings - could use wouter's setLocation here
                    window.location.href = '/settings/traffic-config';
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Configure Settings
                </Button>
              </div>
            )}

            {/* Bearer Token Input */}
            {hasConfig && (
              <div className="space-y-2">
                <Label htmlFor="bearer-token">
                  Bearer Token <span className="text-red-500">*</span> <span className="text-muted-foreground font-normal">(this is a short term solution)</span>
                </Label>
                <Input
                  id="bearer-token"
                  type="password"
                  placeholder="Enter your Canton wallet bearer token"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  disabled={executeTrafficPurchase.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Your bearer token is never stored. It is used only for this request and discarded immediately.
                </p>
              </div>
            )}

            {/* Validation warnings */}
            {(!validatorPartyId || !trafficAmountBytes) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  <span>Missing escrow metadata. Ensure validatorPartyId and trafficAmountBytes are set.</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleShowConfirmation}
                disabled={
                  !hasConfig ||
                  !bearerToken.trim() ||
                  !validatorPartyId ||
                  !trafficAmountBytes
                }
              >
                Execute Purchase
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold">Confirm Execution</h3>
              </div>

              <div className="mb-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  This will execute a traffic purchase of <strong>{trafficAmountBytes ? formatBytes(trafficAmountBytes) : 'unknown'}</strong> for escrow <strong>#{escrow.id.slice(0, 8)}</strong>.
                </p>
                <p className="text-sm font-medium text-red-600">
                  This action is irreversible. Are you sure you want to proceed?
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  disabled={executeTrafficPurchase.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={executeTrafficPurchase.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {executeTrafficPurchase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Yes, Execute Purchase
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
