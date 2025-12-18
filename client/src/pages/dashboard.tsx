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
