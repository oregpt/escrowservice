import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Plus, UserPlus, Trash2, Loader2, Users, X, Shield, User, Settings2 } from "lucide-react";
import { OrgFeatureFlagsEditor } from "@/components/org/OrgFeatureFlagsEditor";
import { useAdminOrganizations, useOrganizations, useAuth } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getSessionId } from "@/lib/api";

interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'admin' | 'member';
  canUseOrgAccount: boolean;
  canCreateEscrows: boolean;
  canManageMembers: boolean;
  joinedAt: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export default function AdminOrganizationsPage() {
  const { toast } = useToast();
  const { data: authData } = useAuth();
  const isPlatformAdmin = authData?.user?.role === 'platform_admin';

  // Platform admins see all organizations, org admins see only their orgs
  const { data: adminOrgs, isLoading: isLoadingAdmin, refetch: refetchAdmin } = useAdminOrganizations();
  const { data: userOrgs, isLoading: isLoadingUser, refetch: refetchUser } = useOrganizations();

  // Use the appropriate data based on role
  const orgs = isPlatformAdmin ? adminOrgs : userOrgs;
  const isLoading = isPlatformAdmin ? isLoadingAdmin : isLoadingUser;
  const refetch = isPlatformAdmin ? refetchAdmin : refetchUser;
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFeatureFlagsDialog, setShowFeatureFlagsDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Member management state
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const getHeaders = (): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const sessionId = getSessionId();
    if (sessionId) {
      headers['X-Session-ID'] = sessionId;
    }
    return headers;
  };

  // Fetch members when dialog opens
  useEffect(() => {
    if (showMembersDialog && selectedOrg) {
      fetchMembers(selectedOrg.id);
    }
  }, [showMembersDialog, selectedOrg]);

  const fetchMembers = async (orgId: string) => {
    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setMembers(data.data);
      } else {
        toast({ title: "Error", description: data.error || "Failed to load members", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load members", variant: "destructive" });
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !selectedOrg) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }

    setIsAddingMember(true);
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/members`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Success", description: "Member added successfully" });
        setNewMemberEmail("");
        setNewMemberRole('member');
        fetchMembers(selectedOrg.id);
        refetch();
      } else {
        toast({ title: "Error", description: data.error || "Failed to add member", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add member", variant: "destructive" });
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedOrg) return;

    setRemovingMemberId(memberId);
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Success", description: "Member removed successfully" });
        fetchMembers(selectedOrg.id);
        refetch();
      } else {
        toast({ title: "Error", description: data.error || "Failed to remove member", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    if (!selectedOrg) return;

    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ role: newRole, canManageMembers: newRole === 'admin' }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Success", description: "Member role updated" });
        fetchMembers(selectedOrg.id);
      } else {
        toast({ title: "Error", description: data.error || "Failed to update role", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
  };

  const handleAddOrg = async () => {
    if (!newOrgName.trim()) {
      toast({ title: "Error", description: "Organization name is required", variant: "destructive" });
      return;
    }

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const sessionId = getSessionId();
      if (sessionId) {
        headers['X-Session-ID'] = sessionId;
      }

      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          name: newOrgName,
          slug: newOrgSlug || newOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-')
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Success", description: "Organization created successfully" });
        setShowAddDialog(false);
        setNewOrgName("");
        setNewOrgSlug("");
        refetch();
      } else {
        toast({ title: "Error", description: data.error || "Failed to create organization", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create organization", variant: "destructive" });
    }
  };

  const handleDeleteOrg = (org: any) => {
    setSelectedOrg(org);
    setShowDeleteDialog(true);
  };

  const confirmDeleteOrg = async () => {
    if (!selectedOrg) return;

    setIsDeleting(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const sessionId = getSessionId();
      if (sessionId) {
        headers['X-Session-ID'] = sessionId;
      }

      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Success", description: "Organization deleted successfully" });
        setShowDeleteDialog(false);
        setSelectedOrg(null);
        refetch();
      } else {
        toast({ title: "Error", description: data.error || "Failed to delete organization", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete organization", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManageMembers = (org: any) => {
    setSelectedOrg(org);
    setShowMembersDialog(true);
  };

  const handleFeatureFlags = (org: any) => {
    setSelectedOrg(org);
    setShowFeatureFlagsDialog(true);
  };

  return (
    <AdminLayout
      title={isPlatformAdmin ? "Organization Management" : "My Organization"}
      description={isPlatformAdmin ? "Manage registered organizations, verification status, and membership." : "Manage your organization settings and members."}
    >
      <div className="space-y-6">
        {isPlatformAdmin && (
          <div className="flex justify-end">
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Organization
            </Button>
          </div>
        )}

        <Card>
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orgs && orgs.length > 0 ? (
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
                          {org.logoUrl && <AvatarImage src={org.logoUrl} />}
                          <AvatarFallback className="rounded-lg">{org.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="font-mono">@{org.slug}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.status === 'active' ? 'outline' : 'destructive'} className="capitalize">
                        {org.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell>{org.memberCount || 0} Users</TableCell>
                    <TableCell className="text-right font-mono">
                      ${(org.totalBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleManageMembers(org)}>
                            <UserPlus className="mr-2 h-4 w-4" /> Manage Members
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleFeatureFlags(org)}>
                            <Settings2 className="mr-2 h-4 w-4" /> Feature Flags
                          </DropdownMenuItem>
                          {isPlatformAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteOrg(org)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No organizations found</p>
              {isPlatformAdmin && (
                <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create First Organization
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Add Organization Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Organization</DialogTitle>
            <DialogDescription>Create a new organization on the platform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="Acme Corp"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input
                id="slug"
                placeholder="acme-corp"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly identifier. Leave blank to auto-generate.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddOrg}>Create Organization</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={(open) => {
        setShowMembersDialog(open);
        if (!open) {
          setMembers([]);
          setNewMemberEmail("");
          setNewMemberRole('member');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Members - {selectedOrg?.name}</DialogTitle>
            <DialogDescription>Add, remove, and manage member roles.</DialogDescription>
          </DialogHeader>

          {/* Add Member Form */}
          <div className="flex gap-2 py-4 border-b">
            <Input
              placeholder="Email address"
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={newMemberRole} onValueChange={(v: 'admin' | 'member') => setNewMemberRole(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddMember} disabled={isAddingMember || !newMemberEmail.trim()}>
              {isAddingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-auto py-2">
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No members found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                        <AvatarFallback>
                          {(member.displayName || member.email || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">
                          {member.displayName || member.email || 'Unknown User'}
                        </div>
                        {member.email && member.displayName && (
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(v: 'admin' | 'member') => handleUpdateMemberRole(member.userId, v)}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" /> Member
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="h-3 w-3" /> Admin
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={removingMemberId === member.userId}
                      >
                        {removingMemberId === member.userId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedOrg?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the organization, all its members, and the associated account.
              Organizations with active escrows or remaining balance cannot be deleted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteOrg} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Flags Editor */}
      {selectedOrg && (
        <OrgFeatureFlagsEditor
          orgId={selectedOrg.id}
          orgName={selectedOrg.name}
          open={showFeatureFlagsDialog}
          onOpenChange={setShowFeatureFlagsDialog}
        />
      )}
    </AdminLayout>
  );
}
