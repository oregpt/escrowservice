import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, UserPlus, Settings, MoreHorizontal, Loader2, Plus } from "lucide-react";
import { AccountSummary } from "@/components/account/AccountSummary";
import { useRoute } from "wouter";
import { useState } from "react";
import { useOrganization, useOrgMembers, useCreateOrganization, useOrganizations } from "@/hooks/use-api";
import { organizations } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Create new organization form
function CreateOrganizationForm() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const createOrg = useCreateOrganization();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter an organization name", variant: "destructive" });
      return;
    }

    try {
      await createOrg.mutateAsync({ name, billingEmail: billingEmail || undefined });
      toast({ title: "Organization created!", description: `${name} has been created successfully.` });
      setName('');
      setBillingEmail('');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create organization",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Create Organization
        </CardTitle>
        <CardDescription>
          Create a new organization to manage team accounts and escrows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Organization Name</label>
          <Input
            placeholder="Acme Corp"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Billing Email (optional)</label>
          <Input
            type="email"
            placeholder="billing@example.com"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          onClick={handleCreate}
          disabled={createOrg.isPending}
        >
          {createOrg.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create Organization
        </Button>
      </CardContent>
    </Card>
  );
}

// Organization detail view
function OrganizationDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const { data: orgData, isLoading: orgLoading } = useOrganization(id);
  const { data: members, isLoading: membersLoading } = useOrgMembers(id);
  const { data: orgAccount, isLoading: accountLoading } = useQuery({
    queryKey: ['organizations', id, 'account'],
    queryFn: async () => {
      const res = await organizations.getAccount(id);
      return res.success ? res.data : null;
    },
    enabled: !!id,
  });

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const org = orgData?.organization;

  if (!org) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Organization not found</h2>
          <p className="text-muted-foreground">This organization doesn't exist or you don't have access.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-slate-900 rounded-xl flex items-center justify-center text-white">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-12 w-12 rounded" />
            ) : (
              <Building2 className="h-8 w-8" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {org.isActive ? (
                <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">Active</Badge>
              ) : (
                <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">Inactive</Badge>
              )}
              <span className="text-sm text-muted-foreground">@{org.slug}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" /> Invite Member
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <AccountSummary
              totalBalance={orgAccount?.totalBalance || 0}
              availableBalance={orgAccount?.availableBalance || 0}
              inContractBalance={orgAccount?.inContractBalance || 0}
              currency={orgAccount?.currency || "USD"}
              isLoading={accountLoading}
            />

            <Card>
              <CardHeader>
                <CardTitle>Organization Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Team Members</span>
                  <span className="font-bold text-lg">{members?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Billing Email</span>
                  <span className="text-sm">{org.billingEmail || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-sm">{new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage who has access to organization funds.</CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : members && members.length > 0 ? (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{member.role[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">User {member.userId.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.joinedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">{member.role}</Badge>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No team members yet. Invite someone to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name</label>
                <Input defaultValue={org.name} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug</label>
                <Input defaultValue={org.slug} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Billing Email</label>
                <Input defaultValue={org.billingEmail || ''} placeholder="billing@example.com" />
              </div>
              <Button className="mt-4">Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function OrganizationPage() {
  const [, params] = useRoute('/org/:id');
  const id = params?.id;

  // If ID is 'new', show create form
  const isNew = id === 'new';

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        {isNew ? (
          <CreateOrganizationForm />
        ) : id ? (
          <OrganizationDetail id={id} />
        ) : (
          <CreateOrganizationForm />
        )}
      </PageContainer>
    </div>
  );
}
