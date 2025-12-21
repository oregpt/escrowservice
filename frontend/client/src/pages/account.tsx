import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { LedgerTable } from "@/components/account/LedgerTable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Plus, Loader2, ArrowLeft, Copy, Check, Building2, CreditCard, Bitcoin, Building, User, Wallet } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useAllAccounts, useLedger, useOrganizations, usePaymentProviders, useDepositToAccount } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PaymentProviderType, AccountWithOrgInfo } from "@/lib/api";

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

  // Filter state
  const [showOrgAccounts, setShowOrgAccounts] = useState(true);
  const [showPersonalAccounts, setShowPersonalAccounts] = useState(true);

  // Deposit target
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const { data: allAccounts, isLoading: accountsLoading } = useAllAccounts();
  const { data: ledgerData, isLoading: ledgerLoading } = useLedger(50, 0);
  const { data: userOrgs } = useOrganizations();
  const { data: providers, isLoading: providersLoading } = usePaymentProviders();
  const depositToAccount = useDepositToAccount();

  // Filter accounts based on checkboxes
  const filteredAccounts = allAccounts?.filter(acc => {
    if (showOrgAccounts && showPersonalAccounts) return true; // Show all
    if (!showOrgAccounts && !showPersonalAccounts) return true; // Show all if both unchecked (fallback)
    if (showOrgAccounts && acc.accountType === 'organization') return true;
    if (showPersonalAccounts && acc.accountType === 'personal') return true;
    return false;
  }) || [];

  // Calculate totals from filtered accounts
  const totalBalance = filteredAccounts.reduce((sum, acc) => sum + (acc.totalBalance || 0), 0);
  const availableBalance = filteredAccounts.reduce((sum, acc) => sum + (acc.availableBalance || 0), 0);
  const inContractBalance = filteredAccounts.reduce((sum, acc) => sum + (acc.inContractBalance || 0), 0);

  // Get selected account for deposit
  const selectedAccount = allAccounts?.find(acc => acc.id === selectedAccountId);

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

    if (!selectedAccount || !selectedAccount.organizationId) {
      toast({
        title: "Select Target Wallet",
        description: "Please select which wallet to deposit to",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await depositToAccount.mutateAsync({
        amount,
        orgId: selectedAccount.organizationId,
        accountType: selectedAccount.accountType,
        currency: 'USD',
      });

      if (result?.checkoutUrl) {
        // Redirect to payment provider (e.g., Stripe Checkout)
        window.location.href = result.checkoutUrl;
      } else {
        toast({
          title: "Payment Initiated",
          description: "Payment session created but no redirect URL received. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    }
  };

  // Auto-select first enabled provider
  useEffect(() => {
    if (providers && providers.length > 0 && !selectedProvider) {
      const firstEnabled = providers.find(p => p.enabled && !p.comingSoon);
      if (firstEnabled) {
        setSelectedProvider(firstEnabled.type);
      }
    }
  }, [providers, selectedProvider]);

  // Auto-select first account for deposit
  useEffect(() => {
    if (allAccounts && allAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(allAccounts[0].id);
    }
  }, [allAccounts, selectedAccountId]);

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
              {/* Balances Header with Filters */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Balances
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="org-accounts"
                          checked={showOrgAccounts}
                          onCheckedChange={(checked) => setShowOrgAccounts(checked === true)}
                        />
                        <Label htmlFor="org-accounts" className="text-sm text-muted-foreground cursor-pointer">
                          Organization
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="personal-accounts"
                          checked={showPersonalAccounts}
                          onCheckedChange={(checked) => setShowPersonalAccounts(checked === true)}
                        />
                        <Label htmlFor="personal-accounts" className="text-sm text-muted-foreground cursor-pointer">
                          Personal
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Summary Row */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Balance</p>
                      <p className="text-2xl font-bold font-mono">
                        ${totalBalance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className="text-xl font-semibold font-mono text-emerald-600">
                        ${availableBalance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">In Escrow</p>
                      <p className="text-xl font-semibold font-mono text-amber-600">
                        ${inContractBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Account List */}
                  {accountsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredAccounts.length > 0 ? (
                    <div className="space-y-2">
                      {filteredAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex items-center justify-center w-10 h-10 rounded-lg",
                              acc.accountType === 'organization'
                                ? "bg-blue-100 text-blue-600"
                                : "bg-purple-100 text-purple-600"
                            )}>
                              {acc.accountType === 'organization' ? (
                                <Building2 className="h-5 w-5" />
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{acc.organizationName}</span>
                                <Badge variant={acc.accountType === 'organization' ? 'default' : 'secondary'} className="text-xs">
                                  {acc.accountType === 'organization' ? 'Org' : 'Personal'}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Available: ${acc.availableBalance.toFixed(2)} | In Escrow: ${acc.inContractBalance.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-semibold">${acc.totalBalance.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No accounts found. Join an organization to get started.
                    </div>
                  )}
                </CardContent>
              </Card>

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
                  <CardDescription>Deposit to your wallet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Wallet Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Deposit To</label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        {allAccounts?.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            <div className="flex items-center gap-2">
                              {acc.accountType === 'organization' ? (
                                <Building2 className="h-4 w-4 text-blue-600" />
                              ) : (
                                <User className="h-4 w-4 text-purple-600" />
                              )}
                              <span>{acc.organizationName}</span>
                              <Badge variant={acc.accountType === 'organization' ? 'default' : 'secondary'} className="text-xs ml-1">
                                {acc.accountType === 'organization' ? 'Org' : 'Personal'}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                    disabled={depositToAccount.isPending || !selectedProvider || !selectedAccountId}
                  >
                    {depositToAccount.isPending ? (
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
                      ${inContractBalance.toFixed(2)}
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
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Organization Wallets</span>
                    <span className="font-mono">
                      {allAccounts?.filter(a => a.accountType === 'organization').length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Personal Wallets</span>
                    <span className="font-mono">
                      {allAccounts?.filter(a => a.accountType === 'personal').length || 0}
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
