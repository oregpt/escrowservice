import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle, Zap, Copy, ArrowLeft, Code, ArrowRight, Download, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';
import { useTrafficConfig, useStandaloneTrafficPurchase, useStandaloneTrafficStatus, useIsFeatureEnabled } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import type { TrafficPurchaseResponse, StandaloneStatusCheckResponse } from '@/lib/api';

// Confirmation steps: 0 = form, 1 = warning, 2 = curl preview
type ConfirmationStep = 0 | 1 | 2;

export default function BuyTraffic() {
  const { toast } = useToast();

  // Form state
  const [receivingValidatorPartyId, setReceivingValidatorPartyId] = useState('');
  const [trafficAmountBytes, setTrafficAmountBytes] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [iapCookie, setIapCookie] = useState('');

  // UI state
  const [confirmationStep, setConfirmationStep] = useState<ConfirmationStep>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<TrafficPurchaseResponse | null>(null);

  // Status check state
  const [statusCheckResult, setStatusCheckResult] = useState<StandaloneStatusCheckResponse | null>(null);
  const [showStatusCheckForm, setShowStatusCheckForm] = useState(false);
  const [statusCheckToken, setStatusCheckToken] = useState('');
  const [statusCheckCookie, setStatusCheckCookie] = useState('');

  // Fetch config and feature flag
  const { data: trafficConfig, isLoading: configLoading } = useTrafficConfig();
  const trafficBuyerEnabled = useIsFeatureEnabled('traffic_buyer');
  const executeTrafficPurchase = useStandaloneTrafficPurchase();
  const checkTrafficStatus = useStandaloneTrafficStatus();

  const hasConfig = trafficConfig && trafficConfig.walletValidatorUrl && trafficConfig.domainId;
  const parsedAmount = parseInt(trafficAmountBytes) || 0;

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

  // Generate curl command preview
  const curlPreview = useMemo(() => {
    if (!trafficConfig || !receivingValidatorPartyId || !parsedAmount) return '';

    const apiUrl = `${trafficConfig.walletValidatorUrl}/api/validator/v0/wallet/buy-traffic-requests`;
    const trackingId = `traffic-standalone-<generated-uuid>`;
    const expiresAt = (Date.now() + 24 * 60 * 60 * 1000) * 1000;

    const payload = {
      receiving_validator_party_id: receivingValidatorPartyId,
      domain_id: trafficConfig.domainId,
      traffic_amount: parsedAmount,
      tracking_id: trackingId,
      expires_at: expiresAt,
    };

    const maskedToken = bearerToken ? `${bearerToken.slice(0, 20)}...${bearerToken.slice(-10)}` : '<BEARER_TOKEN>';

    let curlCmd = `curl --socks5-hostname 127.0.0.1:8080 -X POST '${apiUrl}' \\
  --header 'Content-Type: application/json' \\
  --header 'Authorization: Bearer ${maskedToken}'`;

    if (iapCookie.trim()) {
      const maskedCookie = iapCookie.length > 50
        ? `${iapCookie.slice(0, 30)}...${iapCookie.slice(-10)}`
        : iapCookie;
      curlCmd += ` \\
  --cookie '${maskedCookie}'`;
    }

    curlCmd += ` \\
  --data '${JSON.stringify(payload, null, 2)}'`;

    return curlCmd;
  }, [trafficConfig, receivingValidatorPartyId, parsedAmount, bearerToken, iapCookie]);

  const handleShowWarning = () => {
    if (!bearerToken.trim()) {
      toast({ title: 'Error', description: 'Bearer token is required', variant: 'destructive' });
      return;
    }
    if (!receivingValidatorPartyId.trim()) {
      toast({ title: 'Error', description: 'Receiving Validator Party ID is required', variant: 'destructive' });
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: 'Error', description: 'Traffic amount must be a positive number', variant: 'destructive' });
      return;
    }
    setConfirmationStep(1);
  };

  const handleShowCurlPreview = () => {
    setConfirmationStep(2);
  };

  const handleExecute = async () => {
    try {
      const response = await executeTrafficPurchase.mutateAsync({
        receivingValidatorPartyId: receivingValidatorPartyId.trim(),
        trafficAmountBytes: parsedAmount,
        bearerToken: bearerToken.trim(),
        iapCookie: iapCookie.trim() || undefined,
      });
      setResult(response);
      setBearerToken('');
      setIapCookie('');
      setConfirmationStep(0);

      if (response.success) {
        toast({ title: 'Success', description: 'Traffic purchase executed successfully' });
      }
    } catch (error: any) {
      let errorMessage = 'Failed to execute traffic purchase';
      if (error?.message) {
        errorMessage = error.message;
      }

      setResult({
        success: false,
        error: errorMessage,
      });

      toast({
        title: 'Execution Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      setConfirmationStep(0);
    }
  };

  const handleCheckStatus = async () => {
    if (!result?.trackingId || !statusCheckToken.trim()) {
      toast({ title: 'Error', description: 'Tracking ID and Bearer Token are required', variant: 'destructive' });
      return;
    }

    try {
      const statusResult = await checkTrafficStatus.mutateAsync({
        trackingId: result.trackingId,
        bearerToken: statusCheckToken.trim(),
        iapCookie: statusCheckCookie.trim() || undefined,
      });
      setStatusCheckResult(statusResult);
      setStatusCheckToken('');
      setStatusCheckCookie('');

      if (statusResult.cantonStatus?.status === 'completed' || statusResult.cantonStatus?.status === 'success') {
        toast({
          title: 'Traffic Purchase Completed',
          description: 'The Canton Network has confirmed the purchase.',
        });
      } else if (statusResult.cantonStatus?.status === 'failed') {
        toast({
          title: 'Traffic Purchase Failed',
          description: statusResult.cantonStatus.failure_reason || 'Unknown failure',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Status Check Failed',
        description: error?.message || 'Failed to check status',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setResult(null);
    setStatusCheckResult(null);
    setShowStatusCheckForm(false);
    setStatusCheckToken('');
    setStatusCheckCookie('');
    setReceivingValidatorPartyId('');
    setTrafficAmountBytes('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  const downloadEvidence = () => {
    if (!result) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `traffic-purchase-evidence-${timestamp}.txt`;

    const content = `Canton Network Traffic Purchase Evidence
========================================
Date: ${new Date().toLocaleString()}
Type: Standalone Purchase (No Escrow)

Tracking ID:
${result.trackingId || 'N/A'}

Response Details:
${result.response ? JSON.stringify(result.response, null, 2) : 'N/A'}

Purchase Details:
- Traffic Amount: ${formatBytes(parsedAmount)} (${parsedAmount} bytes)
- Receiving Validator: ${receivingValidatorPartyId}
- Domain ID: ${trafficConfig?.domainId || 'N/A'}
- Wallet URL: ${trafficConfig?.walletValidatorUrl || 'N/A'}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: 'Downloaded', description: 'Evidence file saved' });
  };

  // Feature not enabled
  if (!trafficBuyerEnabled) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <PageContainer className="flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Feature Not Available
              </CardTitle>
              <CardDescription>
                The Traffic Buyer feature is not enabled for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <PageContainer>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-500" />
              Buy Traffic (onchain)
            </h1>
            <p className="text-muted-foreground mt-1">
              Purchase Canton Network traffic directly without creating a deal.
            </p>
          </div>

          {result ? (
            // Show result after execution
            <Card>
              <CardContent className="pt-6">
                {result.success ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-emerald-900">Traffic Purchase Successful</span>
                      </div>

                      {result.trackingId && (
                        <div className="space-y-2">
                          <Label className="text-xs text-emerald-700">Tracking ID</Label>
                          <div className="flex items-center gap-2 min-w-0">
                            <code className="flex-1 min-w-0 bg-white px-3 py-2 rounded border border-emerald-200 text-sm font-mono break-all">
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
                        <div className="mt-4 min-w-0">
                          <Label className="text-xs text-emerald-700">Response Details</Label>
                          <pre className="mt-2 bg-white p-3 rounded border border-emerald-200 text-xs overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                            {JSON.stringify(result.response, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Download Evidence Button */}
                      <div className="mt-4 pt-3 border-t border-emerald-200">
                        <Button
                          variant="outline"
                          className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                          onClick={downloadEvidence}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Evidence
                        </Button>
                      </div>

                      {/* Check Status Section */}
                      {result.trackingId && (
                        <div className="mt-4 pt-3 border-t border-emerald-200">
                          {!showStatusCheckForm && !statusCheckResult ? (
                            <Button
                              variant="outline"
                              className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                              onClick={() => setShowStatusCheckForm(true)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Check Canton Status
                            </Button>
                          ) : showStatusCheckForm && !statusCheckResult ? (
                            <div className="space-y-3">
                              <h5 className="font-medium text-sm text-blue-900">Check Purchase Status</h5>
                              <p className="text-xs text-muted-foreground">
                                Verify the traffic purchase status on the Canton Network.
                              </p>

                              <div className="space-y-2">
                                <Label htmlFor="status-token" className="text-xs">
                                  Bearer Token <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="status-token"
                                  type="password"
                                  placeholder="Enter your Canton wallet bearer token"
                                  value={statusCheckToken}
                                  onChange={(e) => setStatusCheckToken(e.target.value)}
                                  disabled={checkTrafficStatus.isPending}
                                  className="text-sm"
                                />
                              </div>

                              {/* Advanced Options for Status Check */}
                              <div className="border rounded-lg">
                                <button
                                  type="button"
                                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors rounded-lg"
                                  onClick={() => setShowAdvanced(!showAdvanced)}
                                >
                                  <span>Advanced Options</span>
                                  {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </button>

                                {showAdvanced && (
                                  <div className="px-3 pb-3 border-t">
                                    <div className="pt-2">
                                      <Label htmlFor="status-iap-cookie" className="text-xs">
                                        IAP Cookie <Badge variant="outline" className="ml-1 text-[10px]">MPCH only</Badge>
                                      </Label>
                                      <Input
                                        id="status-iap-cookie"
                                        type="password"
                                        placeholder="GCP IAP cookie (optional)"
                                        value={statusCheckCookie}
                                        onChange={(e) => setStatusCheckCookie(e.target.value)}
                                        disabled={checkTrafficStatus.isPending}
                                        className="mt-1 text-sm"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setShowStatusCheckForm(false);
                                    setStatusCheckToken('');
                                    setStatusCheckCookie('');
                                  }}
                                  disabled={checkTrafficStatus.isPending}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleCheckStatus}
                                  disabled={!statusCheckToken.trim() || checkTrafficStatus.isPending}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                  {checkTrafficStatus.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                  Check Status
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {/* Status Check Result */}
                          {statusCheckResult && (
                            <div className="space-y-3">
                              <div className={`rounded-lg p-3 ${
                                statusCheckResult.cantonStatus?.status === 'completed' || statusCheckResult.cantonStatus?.status === 'success'
                                  ? 'bg-green-50 border border-green-200'
                                  : statusCheckResult.cantonStatus?.status === 'failed' || statusCheckResult.cantonStatus?.status === 'rejected'
                                    ? 'bg-red-50 border border-red-200'
                                    : 'bg-slate-50 border border-slate-200'
                              }`}>
                                <div className="flex items-center gap-2 mb-2">
                                  {statusCheckResult.cantonStatus?.status === 'completed' || statusCheckResult.cantonStatus?.status === 'success' ? (
                                    <>
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                      <span className="font-medium text-sm text-green-900">Purchase Completed</span>
                                    </>
                                  ) : statusCheckResult.cantonStatus?.status === 'failed' ? (
                                    <>
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                      <span className="font-medium text-sm text-red-900">Purchase Failed</span>
                                    </>
                                  ) : statusCheckResult.cantonStatus?.status === 'rejected' ? (
                                    <>
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                      <span className="font-medium text-sm text-red-900">Purchase Rejected</span>
                                    </>
                                  ) : (
                                    <>
                                      <Loader2 className="h-4 w-4 text-slate-600" />
                                      <span className="font-medium text-sm text-slate-900">Status: {statusCheckResult.cantonStatus?.status || 'Unknown'}</span>
                                    </>
                                  )}
                                </div>

                                {statusCheckResult.cantonStatus?.failure_reason && (
                                  <p className="text-xs text-red-700 mb-2">
                                    Reason: {statusCheckResult.cantonStatus.failure_reason}
                                  </p>
                                )}

                                {statusCheckResult.cantonStatus?.rejection_reason && (
                                  <p className="text-xs text-red-700 mb-2">
                                    Reason: {statusCheckResult.cantonStatus.rejection_reason}
                                  </p>
                                )}
                              </div>

                              {/* Full Canton Response */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Full Canton Response</Label>
                                <pre className="mt-1 bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                                  {JSON.stringify(statusCheckResult.cantonStatus, null, 2)}
                                </pre>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-1 h-7 text-xs"
                                  onClick={() => copyToClipboard(JSON.stringify(statusCheckResult.cantonStatus, null, 2))}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy Response
                                </Button>
                              </div>

                              {/* Check Again Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setStatusCheckResult(null);
                                  setShowStatusCheckForm(true);
                                }}
                                className="w-full"
                              >
                                Check Again
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Button onClick={handleReset} className="w-full">
                      Make Another Purchase
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-red-900">Execution Failed</span>
                      </div>
                      <p className="text-sm text-red-700">{result.error || 'Unknown error occurred'}</p>
                    </div>
                    <Button onClick={handleReset} variant="outline" className="w-full">
                      Try Again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            // Show form before execution
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Purchase Details</CardTitle>
                <CardDescription>
                  Enter the traffic purchase details below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* User Config Status */}
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
                      Please configure your traffic settings (Wallet URL and Domain ID) before making purchases.
                    </p>
                    <Link href="/settings">
                      <Button variant="outline" size="sm" className="mt-3">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Configure Settings
                      </Button>
                    </Link>
                  </div>
                )}

                {hasConfig && (
                  <>
                    {/* Receiving Validator Party ID */}
                    <div className="space-y-2">
                      <Label htmlFor="validator-party-id">
                        Receiving Validator Party ID <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="validator-party-id"
                        type="text"
                        placeholder="Enter the receiving validator party ID"
                        value={receivingValidatorPartyId}
                        onChange={(e) => setReceivingValidatorPartyId(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        The party ID of the validator that will receive the traffic.
                      </p>
                    </div>

                    {/* Traffic Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="traffic-amount">
                        Traffic Amount (bytes) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="traffic-amount"
                        type="number"
                        placeholder="e.g., 1000000 for 1 MB"
                        value={trafficAmountBytes}
                        onChange={(e) => setTrafficAmountBytes(e.target.value)}
                      />
                      {parsedAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          = {formatBytes(parsedAmount)}
                        </p>
                      )}
                    </div>

                    {/* Bearer Token */}
                    <div className="space-y-2">
                      <Label htmlFor="bearer-token">
                        Bearer Token <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="bearer-token"
                        type="password"
                        placeholder="Enter your Canton wallet bearer token"
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your bearer token is never stored. It is used only for this request and discarded immediately.
                      </p>
                    </div>

                    {/* Advanced Options */}
                    <div className="border rounded-lg">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors rounded-lg"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                      >
                        <span>Advanced Options</span>
                        {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      {showAdvanced && (
                        <div className="px-4 pb-4 space-y-2 border-t">
                          <div className="pt-3">
                            <Label htmlFor="iap-cookie">
                              IAP Cookie <Badge variant="outline" className="ml-2 text-xs">MPCH only</Badge>
                            </Label>
                            <Input
                              id="iap-cookie"
                              type="password"
                              placeholder="Enter GCP IAP cookie (e.g., __Host-GCP_IAP_AUTH_TOKEN_...)"
                              value={iapCookie}
                              onChange={(e) => setIapCookie(e.target.value)}
                              className="mt-2"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Required for MPCH validators. Your IAP cookie is never stored.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Execute Button */}
                    <Button
                      onClick={handleShowWarning}
                      disabled={
                        !hasConfig ||
                        !bearerToken.trim() ||
                        !receivingValidatorPartyId.trim() ||
                        !parsedAmount
                      }
                      className="w-full"
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Step 1: Warning Confirmation */}
        {confirmationStep === 1 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold">Confirm Traffic Purchase</h3>
              </div>

              <div className="mb-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  This will purchase <strong>{formatBytes(parsedAmount)}</strong> of Canton Network traffic for:
                </p>
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Receiving Validator:</span>
                    <p className="font-mono text-xs break-all mt-1">{receivingValidatorPartyId}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Domain ID:</span>
                    <p className="font-mono text-xs break-all mt-1">{trafficConfig?.domainId}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-amber-700">
                  This action will trigger a real blockchain transaction and is irreversible.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setConfirmationStep(0)}>
                  Go Back
                </Button>
                <Button onClick={handleShowCurlPreview} className="bg-blue-600 hover:bg-blue-700">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Curl Preview & Execute */}
        {confirmationStep === 2 && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Code className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold">Review API Call</h3>
              </div>

              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Please review the exact API call that will be made. The bearer token and cookie are partially masked.
                </p>

                <div className="relative">
                  <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                    {curlPreview}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 h-7 px-2"
                    onClick={() => copyToClipboard(curlPreview)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>

                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Note:</strong> The actual <code className="bg-amber-100 px-1 rounded">tracking_id</code> and <code className="bg-amber-100 px-1 rounded">expires_at</code> will be generated at execution time.
                    The call will be routed through the SSH/SOCKS5 tunnel.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setConfirmationStep(1)}
                  disabled={executeTrafficPurchase.isPending}
                >
                  Go Back
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={executeTrafficPurchase.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {executeTrafficPurchase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Zap className="mr-2 h-4 w-4" />
                  Execute on Chain
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
}
