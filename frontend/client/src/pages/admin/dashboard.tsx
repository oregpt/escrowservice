import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  Shield,
  UserCheck,
  Clock,
} from "lucide-react";
import { useAdminStats, useAdminUsers, useAdminEscrows, useUpdateUserRole } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import type { UserRole } from "@/lib/api";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    platform_admin: "bg-red-100 text-red-800 border-red-200",
    admin: "bg-purple-100 text-purple-800 border-purple-200",
    provider: "bg-blue-100 text-blue-800 border-blue-200",
    user: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <Badge variant="outline" className={colors[role] || colors.user}>
      {role.replace('_', ' ')}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    CREATED: "bg-gray-100 text-gray-800",
    AWAITING_PROVIDER: "bg-yellow-100 text-yellow-800",
    ACCEPTED: "bg-blue-100 text-blue-800",
    FUNDED: "bg-indigo-100 text-indigo-800",
    IN_PROGRESS: "bg-purple-100 text-purple-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    DISPUTED: "bg-orange-100 text-orange-800",
  };

  return (
    <Badge variant="secondary" className={colors[status] || "bg-gray-100"}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers(10, 0);
  const { data: escrows, isLoading: escrowsLoading } = useAdminEscrows(10, 0);
  const updateRole = useUpdateUserRole();

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateRole.mutateAsync({ userId, role: newRole });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <AdminLayout
      title="Platform Dashboard"
      description="Overview of platform activity and statistics."
    >
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats?.users.total || 0}
            description={`${stats?.users.authenticated || 0} authenticated, ${stats?.users.anonymous || 0} anonymous`}
            icon={Users}
            loading={statsLoading}
          />
          <StatCard
            title="Organizations"
            value={stats?.organizations.total || 0}
            description={`${stats?.organizations.active || 0} active`}
            icon={Building2}
            loading={statsLoading}
          />
          <StatCard
            title="Total Deals"
            value={stats?.escrows.total || 0}
            description={`${stats?.escrows.active || 0} active, ${stats?.escrows.completed || 0} completed`}
            icon={FileText}
            loading={statsLoading}
          />
          <StatCard
            title="Total Volume"
            value={formatCurrency(stats?.escrows.totalVolume || 0)}
            description={`${formatCurrency(stats?.escrows.totalFees || 0)} in fees`}
            icon={DollarSign}
            loading={statsLoading}
          />
        </div>

        {/* Additional Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Platform Admins"
            value={stats?.users.admins || 0}
            icon={Shield}
            loading={statsLoading}
          />
          <StatCard
            title="Providers"
            value={stats?.users.providers || 0}
            icon={UserCheck}
            loading={statsLoading}
          />
          <StatCard
            title="Funds in Contract"
            value={formatCurrency(stats?.accounts.inContract || 0)}
            description={`${formatCurrency(stats?.accounts.available || 0)} available`}
            icon={TrendingUp}
            loading={statsLoading}
          />
        </div>

        {/* Recent Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent Users
            </CardTitle>
            <CardDescription>
              Manage user roles and view account status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.displayName || 'Anonymous User'}
                          </div>
                          {user.email && (
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {user.username || '-'}
                      </TableCell>
                      <TableCell>
                        {user.isAuthenticated ? (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Authenticated
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Anonymous</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                          disabled={updateRole.isPending}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="provider">Provider</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="platform_admin">Platform Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!users || users.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Escrows Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Escrows
            </CardTitle>
            <CardDescription>
              View and monitor all escrow transactions on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {escrowsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escrow ID</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escrows?.map((escrow) => (
                    <TableRow key={escrow.id}>
                      <TableCell className="font-mono text-sm">
                        {escrow.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {escrow.serviceTypeId}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(escrow.amount))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={escrow.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(escrow.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!escrows || escrows.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No escrows found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
