import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSummary } from "@/components/account/AccountSummary";
import { LedgerTable } from "@/components/account/LedgerTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Account & Balance</h1>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Export Statement
            </Button>
          </div>

          <AccountSummary 
            totalBalance={1250.00}
            availableBalance={750.00}
            inContractBalance={500.00}
            currency="USD"
          />

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <LedgerTable />
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
