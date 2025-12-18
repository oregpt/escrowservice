import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const transactions = [
  {
    id: "tx_1",
    date: "Dec 18, 2025",
    description: "Deposit from Stripe",
    amount: 1000.00,
    type: "credit",
    status: "completed"
  },
  {
    id: "tx_2",
    date: "Dec 18, 2025",
    description: "Escrow Funding #esc_12345678",
    amount: -100.00,
    type: "debit",
    status: "completed"
  },
  {
    id: "tx_3",
    date: "Dec 15, 2025",
    description: "Deposit from Wire Transfer",
    amount: 500.00,
    type: "credit",
    status: "completed"
  },
  {
    id: "tx_4",
    date: "Dec 10, 2025",
    description: "Withdrawal to Bank Account",
    amount: -150.00,
    type: "debit",
    status: "processing"
  }
];

export function LedgerTable() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium">{tx.date}</TableCell>
              <TableCell>{tx.description}</TableCell>
              <TableCell>
                <Badge variant={tx.status === 'completed' ? 'outline' : 'secondary'} className="capitalize">
                  {tx.status}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-mono ${tx.type === 'credit' ? 'text-emerald-600' : ''}`}>
                {tx.type === 'credit' ? '+' : ''}
                ${Math.abs(tx.amount).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
