import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Settings2, Zap, Wrench } from 'lucide-react';
import { useOrgFeatureFlags, useSetFeatureFlag } from '@/hooks/use-api';
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
};

export function OrgFeatureFlagsEditor({ orgId, orgName, open, onOpenChange }: OrgFeatureFlagsEditorProps) {
  const { toast } = useToast();
  const { data: flagsData, isLoading, refetch } = useOrgFeatureFlags(orgId);
  const setFeatureFlag = useSetFeatureFlag();
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  // Reset pending changes when dialog closes
  useEffect(() => {
    if (!open) {
      setPendingChanges({});
    }
  }, [open]);

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
