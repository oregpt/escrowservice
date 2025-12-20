import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Shield, Globe, Loader2, CheckCircle } from "lucide-react";
import type { EscrowCardProps } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-slate-100 text-slate-700 border-slate-200",
  PENDING_ACCEPTANCE: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING_FUNDING: "bg-amber-50 text-amber-700 border-amber-200",
  FUNDED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTY_B_CONFIRMED: "bg-purple-50 text-purple-700 border-purple-200",
  PARTY_A_CONFIRMED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  COMPLETED: "bg-slate-900 text-white border-slate-900",
  CANCELED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-stone-50 text-stone-700 border-stone-200",
  DISPUTED: "bg-orange-50 text-orange-700 border-orange-200",
};

export function EscrowCard({
  id,
  serviceType,
  status,
  amount,
  currency,
  partyA,
  partyB,
  createdAt,
  expiresAt,
  title,
  isOpen,
  canAccept,
  onAccept,
  isAccepting,
}: EscrowCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-primary/10 hover:border-l-primary/40">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Shield className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm tracking-tight">{title || serviceType}</h3>
              <p className="text-xs text-muted-foreground font-mono">#{id.substring(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOpen && (
              <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs font-medium border border-green-200 bg-green-50 text-green-700">
                <Globe className="h-3 w-3 mr-1" />
                Open
              </Badge>
            )}
            <Badge variant="outline" className={cn("rounded-md px-2.5 py-0.5 text-xs font-medium border", STATUS_COLORS[status])}>
              {status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-2xl font-bold font-mono tracking-tight">
            ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-sans text-muted-foreground font-normal">{currency}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm mb-6 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground mb-1">Originator</span>
            <span className="font-medium">{partyA.name}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground mb-1">Counterparty</span>
            <span className="font-medium text-right">{partyB?.name || "Pending..."}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            <span>Expires {expiresAt || "Never"}</span>
          </div>
          <div className="flex items-center gap-2">
            {canAccept && onAccept && (
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={(e) => {
                  e.preventDefault();
                  onAccept();
                }}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1" />
                )}
                Accept
              </Button>
            )}
            <Link href={`/escrow/${id}`}>
              <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-slate-100 hover:text-slate-900 group">
                View Details
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
