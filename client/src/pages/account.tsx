import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSummary } from "@/components/account/AccountSummary";
import { LedgerTable } from "@/components/account/LedgerTable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Loader2, ArrowLeft, Copy, Check, Building2, CreditCard, Bitcoin, Building } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useAccount, useLedger, useOrganizations, usePaymentProviders, useInitiatePayment } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PaymentProviderType } from "@/lib/api";

// Provider icons map
const providerIcons: Record<string, React.ReactNode> = {
  'stripe': <CreditCard className="h-5 w-5" />,
  'credit-card': <CreditCard className="h-5 w-5" />,
  'crypto': <Bitcoin className="h-5 w-5" />,
  'bitcoin': <Bitcoin className="h-5 w-5" />,
  'bank': <Building className="h-5 w-5" />,
  'building-columns': <Building className="h-5 w-5" />,
};

export default function AccountPage() {
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType | null>(null);
  const [copiedOrgId, setCopiedOrgId] = useState<string | null>(null);

  const { data: account, isLoading: accountLoading } = useAccount();
  const { data: ledgerData, isLoading: ledgerLoading } = useLedger(50, 0);
  const { data: userOrgs } = useOrganizations();
  const { data: providers, isLoading: providersLoading } = usePaymentProviders();
  const initiatePayment = useInitiatePayment();

  const handleCopyOrgId = (orgId: string) => {
    navigator.clipboard.writeText(orgId);
    setCopiedOrgId(orgId);
    toast({ title: "Copied!", description: "Organization ID copied to clipboard" });
    setTimeout(() => setCopiedOrgId(null), 2000);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProvider) {
      toast({
        title: "Select Payment Method",
        description: "Please select a payment method",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await initiatePayment.mutateAsync({
        provider: selectedProvider,
        amount,
        currency: 'USD',
      });
      if (result?.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  // Auto-select first enabled provider
  if (providers && providers.length > 0 && !selectedProvider) {
    const firstEnabled = providers.find(p => p.enabled && !p.comingSoon);
    if (firstEnabled) {
      setSelectedProvider(firstEnabled.type);
    }
  }

  // Transform ledger entries for the table
  const ledgerEntries = ledgerData?.entries || [];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="space-y-6">
          <Link href="/">
            <Button variant="ghost" className="mb-2 pl-0 hover:bg-transparent hover:text-primary">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Account & Balance</h1>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Export Statement
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              <AccountSummary
                totalBalance={account?.totalBalance || 0}
                availableBalance={account?.availableBalance || 0}
                inContractBalance={account?.inContractBalance || 0}
                currency={account?.currency || "USD"}
                isLoading={accountLoading}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  {ledgerLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : ledgerEntries.length > 0 ? (
                    <LedgerTable entries={ledgerEntries} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No transactions yet. Deposit funds to get started.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add Funds</CardTitle>
                  <CardDescription>Select a payment method</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Payment Method Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    {providersLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : providers && providers.length > 0 ? (
                      <div className="space-y-2">
                        {providers.map((provider) => (
                          <button
                            key={provider.type}
                            type="button"
                            disabled={!provider.enabled || provider.comingSoon}
                            onClick={() => {
                              if (provider.enabled && !provider.comingSoon) {
                                setSelectedProvider(provider.type);
                              }
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                              selectedProvider === provider.type
                                ? "border-primary bg-primary/5"
                                : "border-slate-200 hover:border-slate-300",
                              (!provider.enabled || provider.comingSoon) && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className={cn(
                              "flex items-center justify-center w-10 h-10 rounded-lg",
                              selectedProvider === provider.type
                                ? "bg-primary text-white"
                                : "bg-slate-100 text-slate-600"
                            )}>
                              {providerIcons[provider.icon || provider.type] || <CreditCard className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{provider.name}</span>
                                {provider.comingSoon && (
                                  <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {provider.description}
                              </p>
                            </div>
                            {selectedProvider === provider.type && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No payment methods available
                      </div>
                    )}
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input
                        placeholder="0.00"
                        className="pl-7 font-mono"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleDeposit}
                    disabled={initiatePayment.isPending || !selectedProvider}
                  >
                    {initiatePayment.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Continue to Payment
                  </Button>
                  {selectedProvider === 'stripe' && (
                    <p className="text-xs text-muted-foreground text-center">
                      Secure payment processing by Stripe
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Deposits</span>
                    <span className="font-mono text-emerald-600">
                      +${ledgerEntries
                        .filter(e => e.entryType === 'DEPOSIT')
                        .reduce((sum, e) => sum + e.amount, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">In Escrow</span>
                    <span className="font-mono">
                      ${account?.inContractBalance?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fees Paid</span>
                    <span className="font-mono text-red-600">
                      -${Math.abs(ledgerEntries
                        .filter(e => e.entryType === 'PLATFORM_FEE')
                        .reduce((sum, e) => sum + e.amount, 0))
                        .toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Organization Info */}
              {userOrgs && userOrgs.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Your Organizations
                    </CardTitle>
                    <CardDescription>
                      Share your Org ID with others to receive escrows
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {userOrgs.map((org) => (
                      <div key={org.id} className="p-3 border rounded-lg space-y-2">
                        <div className="font-medium text-sm">{org.name}</div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-slate-100 px-2 py-1.5 rounded font-mono truncate">
                            {org.id}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleCopyOrgId(org.id)}
                          >
                            {copiedOrgId === org.id ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
