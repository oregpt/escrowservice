import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowUpRight, Plus } from "lucide-react";
import { Link } from "wouter";
import type { AccountSummaryProps } from "@/lib/types";

export function AccountSummary({
  totalBalance,
  availableBalance,
  inContractBalance,
  currency = 'USD'
}: AccountSummaryProps) {
  const availablePercentage = (availableBalance / totalBalance) * 100;
  const inContractPercentage = (inContractBalance / totalBalance) * 100;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
          Balances
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold tracking-tight mb-6 font-mono">
          ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-medium">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <Progress value={100} className="h-2 bg-muted [&>div]:bg-emerald-500" />
            <div className="text-xs text-muted-foreground">{availablePercentage.toFixed(0)}%</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">In Contract</span>
              <span className="font-mono font-medium">${inContractBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <Progress value={100} className="h-2 bg-muted [&>div]:bg-slate-400" />
            <div className="text-xs text-muted-foreground">{inContractPercentage.toFixed(0)}%</div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Link href="/account">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Deposit
            </Button>
          </Link>
          <Button variant="outline" className="flex-1" disabled>
            Withdraw <ArrowUpRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
