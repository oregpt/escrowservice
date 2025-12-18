import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { EscrowCard } from "@/components/escrow/EscrowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Plus, Search, Filter } from "lucide-react";

export default function EscrowList() {
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
    },
    {
      id: "esc_99887766",
      serviceType: "API_KEY_EXCHANGE" as const,
      status: "COMPLETED" as const,
      amount: 50.00,
      currency: "USD",
      partyA: { name: "John Doe" },
      partyB: { name: "Data Service Inc" },
      createdAt: "Dec 10, 2025",
      expiresAt: "Dec 17, 2025"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">All Escrows</h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage all your transactions.</p>
          </div>
          <Link href="/escrow/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Escrow
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by ID or counterparty..." className="pl-9 bg-white" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4">
          {escrows.map(escrow => (
            <EscrowCard key={escrow.id} {...escrow} />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
