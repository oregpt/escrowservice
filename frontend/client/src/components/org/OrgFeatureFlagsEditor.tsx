import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Settings2, Zap, Wrench, Link, Save, CheckCircle } from 'lucide-react';
import { useOrgFeatureFlags, useSetFeatureFlag, useRegistryConfig, useUpdateRegistryConfig } from '@/hooks/use-api';
import { useToast } from '@/hooks/use-toast';
import type { FeatureKey } from '@/lib/api';

interface OrgFeatureFlagsEditorProps {
  orgId: string;
  orgName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Feature metadata for display
const FEATURE_INFO: Record<FeatureKey, {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  tools_section: {
    label: 'Tools Section',
    description: 'Enable the Tools section in user settings for this organization. Members can access specialized tools.',
    icon: Wrench,
    color: 'text-blue-500',
  },
  traffic_buyer: {
    label: 'Traffic Buyer',
    description: 'Allow members to execute Canton Network traffic purchases. Requires Tools Section to be enabled.',
    icon: Zap,
    color: 'text-amber-500',
  },
  tokenization: {
    label: 'Tokenization',
    description: 'Allow members to tokenize escrows on the Canton blockchain via theRegistry. Adds "Tokenize" button to eligible deals.',
    icon: Link,
    color: 'text-purple-500',
  },
};

export function OrgFeatureFlagsEditor({ orgId, orgName, open, onOpenChange }: OrgFeatureFlagsEditorProps) {
  const { toast } = useToast();
  const { data: flagsData, isLoading, refetch } = useOrgFeatureFlags(orgId);
  const setFeatureFlag = useSetFeatureFlag();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  // Registry config for tokenization
  const { data: registryConfig, isLoading: registryConfigLoading } = useRegistryConfig();
  const updateRegistryConfig = useUpdateRegistryConfig();
  const [registryApiKey, setRegistryApiKey] = useState('');
  const [registryEnvironment, setRegistryEnvironment] = useState<'TESTNET' | 'MAINNET'>('TESTNET');
  const [registryWalletAddress, setRegistryWalletAddress] = useState('');

  // Load registry config when available
  useEffect(() => {
    if (registryConfig) {
      setRegistryEnvironment(registryConfig.environment || 'TESTNET');
      setRegistryWalletAddress(registryConfig.walletAddress || '');
    }
  }, [registryConfig]);

  // Reset pending changes when dialog closes
  useEffect(() => {
    if (!open) {
      setPendingChanges({});
      setRegistryApiKey('');
    }
  }, [open]);

  const handleSaveRegistryConfig = async () => {
    try {
      await updateRegistryConfig.mutateAsync({
        apiKey: registryApiKey || undefined,
        environment: registryEnvironment,
        walletAddress: registryWalletAddress || undefined,
      });
      setRegistryApiKey(''); // Clear API key field after save
      toast({ title: "Registry Configuration Saved", description: "Your theRegistry settings have been updated." });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save registry config',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (featureKey: FeatureKey, enabled: boolean) => {
    console.log('[FeatureFlags] handleToggle called', { orgId, featureKey, enabled });
    // Optimistically update UI
    setPendingChanges(prev => ({ ...prev, [featureKey]: true }));

    try {
      console.log('[FeatureFlags] Calling mutateAsync...');
      await setFeatureFlag.mutateAsync({ orgId, featureKey, enabled });
      console.log('[FeatureFlags] Mutation succeeded, showing toast');
      toast({
        title: enabled ? 'Feature Enabled' : 'Feature Disabled',
        description: `${FEATURE_INFO[featureKey].label} has been ${enabled ? 'enabled' : 'disabled'} for ${orgName}.`,
      });
      console.log('[FeatureFlags] Refetching flags...');
      await refetch();
      console.log('[FeatureFlags] Refetch complete, flagsData:', flagsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update feature flag',
        variant: 'destructive',
      });
    } finally {
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[featureKey];
        return updated;
      });
    }
  };

  const getFeatureEnabled = (featureKey: FeatureKey): boolean => {
    // flagsData is already the flags array (not an object with .flags)
    const flags = Array.isArray(flagsData) ? flagsData : [];
    const flag = flags.find(f => f.featureKey === featureKey);
    return flag?.enabled ?? false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Feature Flags
          </DialogTitle>
          <DialogDescription>
            Configure feature access for <strong>{orgName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            Object.entries(FEATURE_INFO).map(([key, info]) => {
              const featureKey = key as FeatureKey;
              const Icon = info.icon;
              const isEnabled = getFeatureEnabled(featureKey);
              const isPending = pendingChanges[featureKey];

              return (
                <div
                  key={featureKey}
                  className={`p-4 rounded-lg border ${
                    isEnabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${info.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={featureKey} className="font-medium cursor-pointer">
                            {info.label}
                          </Label>
                          {isEnabled && (
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {info.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch
                          id={featureKey}
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleToggle(featureKey, checked)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Inline Registry Config when Tokenization is enabled */}
                  {featureKey === 'tokenization' && isEnabled && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">theRegistry Configuration</span>
                        {registryConfig?.isConfigured && (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Configured
                          </Badge>
                        )}
                      </div>

                      {registryConfigLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="registry-api-key" className="text-xs">API Key</Label>
                            <Input
                              id="registry-api-key"
                              type="password"
                              placeholder={registryConfig?.hasApiKey ? "••••••••••••••••" : "Enter your theRegistry API key"}
                              value={registryApiKey}
                              onChange={(e) => setRegistryApiKey(e.target.value)}
                              className="text-sm"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="registry-env" className="text-xs">Environment</Label>
                            <Select value={registryEnvironment} onValueChange={(v) => setRegistryEnvironment(v as 'TESTNET' | 'MAINNET')}>
                              <SelectTrigger id="registry-env" className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="TESTNET">Testnet</SelectItem>
                                <SelectItem value="MAINNET">Mainnet</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="registry-wallet" className="text-xs">Wallet Address (optional)</Label>
                            <Input
                              id="registry-wallet"
                              placeholder="Your Canton wallet address"
                              value={registryWalletAddress}
                              onChange={(e) => setRegistryWalletAddress(e.target.value)}
                              className="text-sm"
                            />
                          </div>

                          <Button
                            size="sm"
                            onClick={handleSaveRegistryConfig}
                            disabled={updateRegistryConfig.isPending}
                            className="w-full"
                          >
                            {updateRegistryConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Registry Config
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
