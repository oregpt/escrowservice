import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { AccountSummary } from "@/components/account/AccountSummary";
import { EscrowCard } from "@/components/escrow/EscrowCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus } from "lucide-react";

export default function Dashboard() {
  // Mock Data
  const escrows = [
    {
      id: "esc_12345678",
      serviceType: "TRAFFIC_BUY" as const,
      status: "FUNDED" as const,
      amount: 100.00,
      currency: "USD",
      partyA: { name: "John Doe" },
      partyB: { name: "Ore Provider" },
      createdAt: "Dec 18, 2025",
      expiresAt: "Dec 25, 2025"
    },
    {
      id: "esc_87654321",
      serviceType: "DOCUMENT_DELIVERY" as const,
      status: "CREATED" as const,
      amount: 2500.00,
      currency: "USD",
      partyA: { name: "John Doe" },
      partyB: null,
      createdAt: "Dec 19, 2025",
      expiresAt: "Jan 19, 2026"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Active Escrows</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your secure transactions.</p>
              </div>
              <Link href="/escrow/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New Escrow
                </Button>
              </Link>
            </div>

            {/* Inbox Section for Pending Actions */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                Pending Your Acceptance
              </h3>
              <div className="space-y-3">
                <div className="bg-white p-3 rounded border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div>
                     <div className="font-medium text-sm">Traffic Buy Request</div>
                     <div className="text-xs text-muted-foreground">From: <span className="font-medium text-foreground">Alice Wonder</span> • $450.00 USD</div>
                   </div>
                   <div className="flex gap-2">
                     <Button size="sm" variant="outline" className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">Reject</Button>
                     <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">Accept & Fund</Button>
                   </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {escrows.map(escrow => (
                <EscrowCard key={escrow.id} {...escrow} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <AccountSummary 
              totalBalance={1250.00}
              availableBalance={750.00}
              inContractBalance={500.00}
              currency="USD"
            />
            
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
              <h3 className="font-semibold text-sm mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium">Traffic Purchase</span>
                      <span className="text-xs text-muted-foreground">Today, 10:23 AM</span>
                    </div>
                    <span className="font-mono text-emerald-600">-$100.00</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
