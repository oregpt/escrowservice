import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, Link, Copy, History, RefreshCw, ExternalLink, Upload } from 'lucide-react';
import { useTokenizeEscrow, useUpdateTokenization, useTokenizationStatus, useTokenizationHistory, useRegistryConfig, useSyncTokenizationStatus, usePushToBlockchain } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import type { Escrow, EscrowWithParties, TokenizationRecord } from '@/lib/api';

interface TokenizeModalProps {
  escrow: Escrow | EscrowWithParties;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TokenizeModal({ escrow, open, onOpenChange }: TokenizeModalProps) {
  const { toast } = useToast();
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showAlreadyTokenizedPrompt, setShowAlreadyTokenizedPrompt] = useState(false);

  const { data: registryConfig, isLoading: configLoading } = useRegistryConfig();
  const { data: tokenizationStatus, isLoading: statusLoading, refetch: refetchStatus } = useTokenizationStatus(escrow.id);
  const { data: tokenizationHistory, isLoading: historyLoading } = useTokenizationHistory(showHistory ? escrow.id : undefined);

  const tokenizeEscrow = useTokenizeEscrow();
  const updateTokenization = useUpdateTokenization();
  const syncStatus = useSyncTokenizationStatus();
  const pushToBlockchain = usePushToBlockchain();

  const isTokenized = tokenizationStatus?.isTokenized;
  const latestRecord = tokenizationStatus?.record;

  const handleSyncStatus = async () => {
    try {
      const result = await syncStatus.mutateAsync(escrow.id);
      if (result?.updated) {
        toast({
          title: 'Status Updated',
          description: 'Contract ID is now available from theRegistry.',
        });
      } else {
        toast({
          title: 'Still Pending',
          description: 'Blockchain sync is still in progress. Try again in a moment.',
        });
      }
      await refetchStatus();
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error?.message || 'Failed to sync status',
        variant: 'destructive',
      });
    }
  };

  const handlePushToBlockchain = async () => {
    try {
      const result = await pushToBlockchain.mutateAsync(escrow.id);
      if (result?.pushed) {
        toast({
          title: 'Push Successful',
          description: 'Asset has been pushed to the Canton blockchain.',
        });
      } else {
        toast({
          title: 'Push Submitted',
          description: 'Push request submitted. Run sync to check status.',
        });
      }
      await refetchStatus();
    } catch (error: any) {
      toast({
        title: 'Push Failed',
        description: error?.message || 'Failed to push to blockchain',
        variant: 'destructive',
      });
    }
  };

  const handleTokenize = async () => {
    try {
      await tokenizeEscrow.mutateAsync({
        escrowId: escrow.id,
        options: {
          customName: customName.trim() || undefined,
          customDescription: customDescription.trim() || undefined,
        },
      });
      toast({
        title: 'Tokenization Successful',
        description: 'Escrow has been registered on the Canton blockchain.',
      });
      // Refetch status to show the tokenized state
      await refetchStatus();
    } catch (error: any) {
      const errorMsg = error?.message?.toLowerCase() || '';
      // Check if already tokenized error
      if (errorMsg.includes('already tokenized') || errorMsg.includes('use update')) {
        setShowAlreadyTokenizedPrompt(true);
        await refetchStatus(); // Refresh to get current tokenization status
      } else {
        toast({
          title: 'Tokenization Failed',
          description: error?.message || 'Failed to tokenize escrow',
          variant: 'destructive',
        });
      }
    }
  };

  const handleUpdate = async () => {
    try {
      // Always sync first to get latest contract_id before updating
      const syncResult = await syncStatus.mutateAsync(escrow.id);
      if (syncResult?.updated) {
        toast({
          title: 'Status Synced',
          description: 'Contract ID updated from theRegistry.',
        });
      }

      // Now proceed with the update
      await updateTokenization.mutateAsync(escrow.id);
      toast({
        title: 'Update Successful',
        description: 'Tokenization metadata has been updated on the Canton blockchain.',
      });
      // Refetch to show updated record
      await refetchStatus();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error?.message || 'Failed to update tokenization',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  const hasConfig = registryConfig?.isConfigured && registryConfig?.hasApiKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-blue-500" />
            {isTokenized ? 'Update Tokenization' : 'Tokenize on Canton'}
          </DialogTitle>
          <DialogDescription>
            {isTokenized
              ? 'Update the on-chain metadata for this escrow.'
              : 'Register this escrow as a digital asset on the Canton blockchain via theRegistry.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Loading states */}
          {(configLoading || statusLoading) && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Config check */}
          {!configLoading && !hasConfig && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-900">Configuration Required</span>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                Your organization needs to configure theRegistry API key before tokenizing escrows.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = '/settings/registry';
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Configure Registry
              </Button>
            </div>
          )}

          {/* Already tokenized prompt - shown when tokenize attempt finds existing */}
          {showAlreadyTokenizedPrompt && !isTokenized && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">Already Tokenized</span>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                This escrow has already been tokenized on theRegistry. Would you like to update the tokenization metadata instead?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAlreadyTokenizedPrompt(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setShowAlreadyTokenizedPrompt(false);
                    handleUpdate();
                  }}
                  disabled={updateTokenization.isPending}
                >
                  {updateTokenization.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Tokenization
                </Button>
              </div>
            </div>
          )}

          {/* Already tokenized - show status */}
          {!statusLoading && isTokenized && latestRecord && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">Tokenized on Canton</span>
                  <Badge variant="outline" className="ml-auto">
                    {latestRecord.environment}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-emerald-700">Contract ID</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 bg-white px-2 py-1 rounded border border-emerald-200 text-xs font-mono break-all">
                        {latestRecord.contractId || 'Pending sync...'}
                      </code>
                      {latestRecord.contractId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copyToClipboard(latestRecord.contractId!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {latestRecord.assetRegistrationId && (
                    <div>
                      <Label className="text-xs text-emerald-700">Asset Registration ID</Label>
                      <p className="font-mono text-sm mt-1">#{latestRecord.assetRegistrationId}</p>
                    </div>
                  )}

                  {/* Blockchain Status Grid - 3 key values */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-emerald-700">Sync Status</Label>
                      <Badge
                        variant={latestRecord.syncStatus === 'synced' ? 'default' : 'secondary'}
                        className={`mt-1 ${latestRecord.syncStatus === 'synced' ? 'bg-emerald-600' : ''}`}
                      >
                        {latestRecord.syncStatus}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-emerald-700">On-Chain Status</Label>
                      <Badge
                        variant={latestRecord.onchainStatus === 'onchain' ? 'default' : 'secondary'}
                        className={`mt-1 ${latestRecord.onchainStatus === 'onchain' ? 'bg-blue-600' : ''}`}
                      >
                        {latestRecord.onchainStatus || 'unchecked'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-emerald-700">Found on Chain</Label>
                      <Badge
                        variant={latestRecord.foundOnChain ? 'default' : 'secondary'}
                        className={`mt-1 ${latestRecord.foundOnChain ? 'bg-green-600' : 'bg-amber-500'}`}
                      >
                        {latestRecord.foundOnChain ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>

                  {/* Sync and Push Buttons */}
                  <div className="flex gap-2">
                    {/* Sync Button - always available to check status */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncStatus}
                      disabled={syncStatus.isPending || pushToBlockchain.isPending}
                      className="flex-1"
                    >
                      {syncStatus.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Check Blockchain
                    </Button>

                    {/* Push Button - only show when onchainStatus is 'local-only' */}
                    {latestRecord.onchainStatus === 'local-only' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handlePushToBlockchain}
                        disabled={pushToBlockchain.isPending || syncStatus.isPending}
                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                      >
                        {pushToBlockchain.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Push to Blockchain
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-emerald-700">Escrow Status</Label>
                      <p className="text-sm mt-1">{latestRecord.escrowStatus}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-emerald-700">Environment</Label>
                      <Badge variant="outline" className="mt-1">{latestRecord.environment}</Badge>
                    </div>
                  </div>

                  {latestRecord.previousContractId && (
                    <div>
                      <Label className="text-xs text-emerald-700">Previous Contract ID</Label>
                      <p className="font-mono text-xs text-muted-foreground break-all">
                        {latestRecord.previousContractId}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Update Button */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-sm text-blue-900 mb-2">Update Tokenization</h4>
                <p className="text-xs text-blue-700 mb-3">
                  Sync the current escrow data to the blockchain. This creates a new contract and archives the previous one.
                </p>
                <Button
                  onClick={handleUpdate}
                  disabled={updateTokenization.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {updateTokenization.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Update Metadata
                </Button>
              </div>

              {/* History Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full"
              >
                <History className="h-4 w-4 mr-2" />
                {showHistory ? 'Hide History' : 'Show History'}
              </Button>

              {/* History */}
              {showHistory && (
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <h4 className="font-medium text-sm mb-3">Tokenization History</h4>
                  {historyLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : tokenizationHistory && tokenizationHistory.length > 0 ? (
                    <div className="space-y-2">
                      {tokenizationHistory.map((record: TokenizationRecord, index: number) => (
                        <div
                          key={record.id}
                          className={`text-xs p-2 rounded ${
                            index === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono">
                              {record.contractId?.slice(0, 20)}...
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {record.escrowStatus}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1">
                            {new Date(record.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No history found</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Not tokenized - show form */}
          {!statusLoading && !isTokenized && hasConfig && (
            <div className="space-y-4">
              {/* Escrow Info */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm">Escrow Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <p className="font-medium">{escrow.serviceTypeId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <p className="font-mono font-medium">
                      ${typeof escrow.amount === 'number' ? escrow.amount.toFixed(2) : escrow.amount}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge variant="outline">{escrow.status}</Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Environment</Label>
                    <Badge variant="secondary">{registryConfig?.environment}</Badge>
                  </div>
                </div>
              </div>

              {/* Optional customization */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="custom-name" className="text-sm">
                    Custom Name <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="custom-name"
                    placeholder={escrow.title || `Escrow ${escrow.id.slice(0, 8)}`}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    disabled={tokenizeEscrow.isPending}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-description" className="text-sm">
                    Custom Description <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="custom-description"
                    placeholder={escrow.description || `${escrow.serviceTypeId} escrow contract`}
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    disabled={tokenizeEscrow.isPending}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <strong>Note:</strong> All escrow data will be stored in the metadata field on the blockchain.
                This includes parties, amounts, status, and timestamps.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isTokenized ? 'Close' : 'Cancel'}
          </Button>
          {!isTokenized && hasConfig && !statusLoading && (
            <Button
              onClick={handleTokenize}
              disabled={tokenizeEscrow.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {tokenizeEscrow.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Link className="mr-2 h-4 w-4" />
              Tokenize
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
