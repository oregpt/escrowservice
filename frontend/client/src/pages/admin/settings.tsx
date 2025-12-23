import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Save, Globe, DollarSign, Shield, Loader2, RefreshCw, Link } from "lucide-react";
import { getSessionId } from "@/lib/api";

interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultPlatformFee: number;
  minEscrowAmount: number;
  maxEscrowAmount: number;
  trafficPricePerMB: number;
  requireEmailVerification: boolean;
  allowAnonymousUsers: boolean;
  maintenanceMode: boolean;
  registryApiUrl: string;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: "Escrow Service",
  supportEmail: "support@escrow.example.com",
  defaultPlatformFee: 15,
  minEscrowAmount: 10,
  maxEscrowAmount: 100000,
  trafficPricePerMB: 60,
  requireEmailVerification: false,
  allowAnonymousUsers: true,
  maintenanceMode: false,
  registryApiUrl: "",
};

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const sessionId = getSessionId();
      if (sessionId) {
        headers['X-Session-ID'] = sessionId;
      }

      const res = await fetch('/api/admin/platform-settings', {
        headers,
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        setSettings(data.data);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load settings",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const sessionId = getSessionId();
      if (sessionId) {
        headers['X-Session-ID'] = sessionId;
      }

      const res = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (data.success) {
        setSettings(data.data);
        toast({
          title: "Settings Saved",
          description: "Platform settings have been updated successfully.",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to save settings",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Platform Settings"
        description="Configure global platform settings and policies."
      >
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Platform Settings"
      description="Configure global platform settings and policies."
    >
      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>Basic platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input
                  id="platformName"
                  value={settings.platformName}
                  onChange={(e) => updateSetting('platformName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => updateSetting('supportEmail', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Settings
            </CardTitle>
            <CardDescription>Configure fees and transaction limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platformFee">Default Platform Fee (%)</Label>
                <Input
                  id="platformFee"
                  type="number"
                  min="0"
                  max="100"
                  value={settings.defaultPlatformFee}
                  onChange={(e) => updateSetting('defaultPlatformFee', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trafficPrice">Traffic Price per MB ($)</Label>
                <Input
                  id="trafficPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.trafficPricePerMB}
                  onChange={(e) => updateSetting('trafficPricePerMB', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Price per MB for Canton Network traffic purchases
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minAmount">Min Escrow Amount ($)</Label>
                <Input
                  id="minAmount"
                  type="number"
                  min="0"
                  value={settings.minEscrowAmount}
                  onChange={(e) => updateSetting('minEscrowAmount', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAmount">Max Escrow Amount ($)</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  min="0"
                  value={settings.maxEscrowAmount}
                  onChange={(e) => updateSetting('maxEscrowAmount', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Access
            </CardTitle>
            <CardDescription>User authentication and access policies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Email Verification</Label>
                <p className="text-sm text-muted-foreground">
                  Users must verify their email before creating escrows
                </p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => updateSetting('requireEmailVerification', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Anonymous Users</Label>
                <p className="text-sm text-muted-foreground">
                  Allow users to browse and create escrows without registration
                </p>
              </div>
              <Switch
                checked={settings.allowAnonymousUsers}
                onCheckedChange={(checked) => updateSetting('allowAnonymousUsers', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Temporarily disable the platform for maintenance
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Registry / Tokenization Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              theRegistry (Tokenization)
            </CardTitle>
            <CardDescription>Configure theRegistry API for Canton blockchain tokenization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="registryApiUrl">theRegistry API URL</Label>
              <Input
                id="registryApiUrl"
                type="url"
                placeholder="https://testnetregistry.agenticledger.ai"
                value={settings.registryApiUrl}
                onChange={(e) => updateSetting('registryApiUrl', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Testnet: https://testnetregistry.agenticledger.ai | Mainnet: https://theregistry.agenticledger.ai
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={fetchSettings} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="min-w-[150px]">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
