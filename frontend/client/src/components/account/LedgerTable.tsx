import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { LedgerEntry } from "@/lib/api";

interface LedgerTableProps {
  entries?: LedgerEntry[];
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAW: 'Withdrawal',
  ESCROW_LOCK: 'Escrow Lock',
  ESCROW_RELEASE: 'Escrow Release',
  ESCROW_RECEIVE: 'Escrow Received',
  PLATFORM_FEE: 'Platform Fee',
  REFUND: 'Refund',
};

export function LedgerTable({ entries = [] }: LedgerTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isCredit = entry.amount > 0;
            const typeLabel = ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType;

            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {entry.description || typeLabel}
                  {entry.referenceId && (
                    <span className="text-xs text-muted-foreground ml-2 font-mono">
                      #{entry.referenceId.slice(0, 8)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize ${
                      entry.bucket === 'in_contract'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : ''
                    }`}
                  >
                    {entry.bucket === 'in_contract' ? 'In Contract' : 'Available'}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-mono ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isCredit ? '+' : ''}${Math.abs(entry.amount).toFixed(2)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
