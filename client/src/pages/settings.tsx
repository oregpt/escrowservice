import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, AlertTriangle, Loader2, Save } from "lucide-react";
import { useState } from "react";
import {
  useAuth,
  useAutoAcceptRules,
  useServiceTypes,
  useUpdateAutoAcceptRule,
  useDeleteAutoAcceptRule,
  useToggleAutoAccept,
  useUpdateProfile,
  useLogin,
} from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: authData, isLoading: authLoading } = useAuth();
  const { data: autoAcceptRules, isLoading: rulesLoading } = useAutoAcceptRules();
  const { data: serviceTypes } = useServiceTypes();

  const updateProfile = useUpdateProfile();
  const login = useLogin();
  const updateRule = useUpdateAutoAcceptRule();
  const deleteRule = useDeleteAutoAcceptRule();
  const toggleRule = useToggleAutoAccept();

  const user = authData?.user;

  // Profile form state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');

  // New rule form state
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [newRuleServiceType, setNewRuleServiceType] = useState('');
  const [newRuleMaxAmount, setNewRuleMaxAmount] = useState('');

  const handleSaveProfile = async () => {
    try {
      // If email is provided and user not authenticated, use login
      if (email && !user?.isAuthenticated) {
        await login.mutateAsync({ email, displayName: displayName || undefined });
        toast({ title: "Profile saved", description: "Your profile has been updated." });
      } else if (displayName !== user?.displayName) {
        await updateProfile.mutateAsync({ displayName });
        toast({ title: "Profile saved", description: "Your profile has been updated." });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive"
      });
    }
  };

  const handleCreateRule = async () => {
    if (!newRuleServiceType) {
      toast({ title: "Service type required", variant: "destructive" });
      return;
    }

    try {
      await updateRule.mutateAsync({
        serviceTypeId: newRuleServiceType,
        data: {
          autoAcceptEnabled: true,
          maxAmount: newRuleMaxAmount ? parseFloat(newRuleMaxAmount) : undefined,
        },
      });
      toast({ title: "Rule created", description: "Auto-accept rule has been created." });
      setShowNewRuleForm(false);
      setNewRuleServiceType('');
      setNewRuleMaxAmount('');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create rule",
        variant: "destructive"
      });
    }
  };

  const handleToggleRule = async (serviceTypeId: string, enabled: boolean) => {
    try {
      await toggleRule.mutateAsync({ serviceTypeId, enabled });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to toggle rule",
        variant: "destructive"
      });
    }
  };

  const handleDeleteRule = async (serviceTypeId: string) => {
    try {
      await deleteRule.mutateAsync(serviceTypeId);
      toast({ title: "Rule deleted" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete rule",
        variant: "destructive"
      });
    }
  };

  const getServiceTypeName = (id: string) => {
    return serviceTypes?.find(st => st.id === id)?.name || id;
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer className="max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Account Settings</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="auto-accept">Auto-Accept Rules</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your profile information. Email is used for login and notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {authLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input
                          placeholder="Your name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <p className="text-sm text-muted-foreground mb-4">
                        {user?.isAuthenticated ? (
                          <span className="text-emerald-600">Authenticated account</span>
                        ) : (
                          <span>Anonymous session - add email to save your progress</span>
                        )}
                      </p>
                      <Button
                        onClick={handleSaveProfile}
                        disabled={updateProfile.isPending || login.isPending}
                      >
                        {(updateProfile.isPending || login.isPending) ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auto-accept">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">Auto-Acceptance Rules</h2>
                  <p className="text-sm text-muted-foreground">
                    Automatically accept incoming escrow requests that meet specific criteria.
                  </p>
                </div>
                <Button onClick={() => setShowNewRuleForm(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Rule
                </Button>
              </div>

              {/* Warning Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Risk Warning</p>
                  <p>Auto-accepted escrows are binding. Ensure your limits are set conservatively.</p>
                </div>
              </div>

              {/* New Rule Form */}
              {showNewRuleForm && (
                <Card className="border-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">New Auto-Accept Rule</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Service Type</Label>
                        <Select value={newRuleServiceType} onValueChange={setNewRuleServiceType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceTypes?.filter(st => st.autoAcceptable).map(st => (
                              <SelectItem key={st.id} value={st.id}>
                                {st.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Max Amount (USD)</Label>
                        <Input
                          type="number"
                          placeholder="No limit"
                          value={newRuleMaxAmount}
                          onChange={(e) => setNewRuleMaxAmount(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreateRule} disabled={updateRule.isPending}>
                        {updateRule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Rule
                      </Button>
                      <Button variant="outline" onClick={() => setShowNewRuleForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rules List */}
              <div className="grid gap-4">
                {rulesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : autoAcceptRules && autoAcceptRules.length > 0 ? (
                  autoAcceptRules.map((rule) => (
                    <Card key={rule.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{getServiceTypeName(rule.serviceTypeId)}</CardTitle>
                            <CardDescription>
                              {rule.maxAmount
                                ? `Auto-accept requests up to $${rule.maxAmount.toFixed(2)}`
                                : 'Auto-accept all requests'}
                            </CardDescription>
                          </div>
                          <Switch
                            checked={rule.autoAcceptEnabled}
                            onCheckedChange={(checked) => handleToggleRule(rule.serviceTypeId, checked)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">Service Type</span>
                            <span className="font-medium">{rule.serviceTypeId}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">Max Amount</span>
                            <span className="font-mono font-medium">
                              {rule.maxAmount ? `$${rule.maxAmount.toFixed(2)} USD` : 'Any Amount'}
                            </span>
                          </div>
                          <div className="flex justify-end items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteRule(rule.serviceTypeId)}
                              disabled={deleteRule.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      No auto-accept rules configured. Add a rule to automatically accept certain escrow requests.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified about activity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email for new escrow requests</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Escrow Updates</Label>
                    <p className="text-sm text-muted-foreground">Get notified when escrow status changes</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Payment Confirmations</Label>
                    <p className="text-sm text-muted-foreground">Receive confirmation for deposits and releases</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Session ID</Label>
                  <Input
                    value={user?.sessionId || 'Not available'}
                    disabled
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your unique session identifier. Keep this private.
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-2">Account Status</h3>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Authenticated:</span>{' '}
                      {user?.isAuthenticated ? 'Yes' : 'No (anonymous)'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Provider Account:</span>{' '}
                      {user?.isProvider ? 'Yes' : 'No'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Account Created:</span>{' '}
                      {user?.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
}
