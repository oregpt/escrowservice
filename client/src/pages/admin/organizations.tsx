import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, UserPlus, Trash2, Ban } from "lucide-react";

export default function AdminOrganizationsPage() {
  const orgs = [
    { id: "1", name: "MPC Holdings", members: 3, verified: true, status: 'active', balance: 50000.00 },
    { id: "2", name: "Acme Corp", members: 12, verified: true, status: 'active', balance: 125000.00 },
    { id: "3", name: "Solo Trader LLC", members: 1, verified: false, status: 'suspended', balance: 0.00 },
  ];

  return (
    <AdminLayout 
      title="Organization Management" 
      description="Manage registered organizations, verification status, and membership."
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Organization
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right">Total Balance</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 rounded-lg border">
                        <AvatarFallback className="rounded-lg">{org.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{org.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {org.verified && <Badge variant="secondary" className="text-[10px] h-4 px-1">Verified</Badge>}
                          ID: {org.id}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={org.status === 'active' ? 'outline' : 'destructive'} className="capitalize">
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{org.members} Users</TableCell>
                  <TableCell className="text-right font-mono">${org.balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><UserPlus className="mr-2 h-4 w-4" /> Manage Members</DropdownMenuItem>
                        <DropdownMenuItem><Ban className="mr-2 h-4 w-4" /> Suspend Org</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AdminLayout>
  );
}
