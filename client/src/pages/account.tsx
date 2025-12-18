import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSummary } from "@/components/account/AccountSummary";
import { LedgerTable } from "@/components/account/LedgerTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Plus, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useAccount, useLedger, useCreateDeposit } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

export default function AccountPage() {
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState('');

  const { data: account, isLoading: accountLoading } = useAccount();
  const { data: ledgerData, isLoading: ledgerLoading } = useLedger(50, 0);
  const createDeposit = useCreateDeposit();

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

    try {
      const result = await createDeposit.mutateAsync({ amount });
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create deposit",
        variant: "destructive",
      });
    }
  };

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
                </CardHeader>
                <CardContent className="space-y-4">
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
                    disabled={createDeposit.isPending}
                  >
                    {createDeposit.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Deposit via Stripe
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Secure payment processing by Stripe
                  </p>
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
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
