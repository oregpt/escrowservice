import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Edit2, Save, X, Loader2, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAdminServiceTypes, useUpdateServiceType, useCreateServiceType } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import type { ServiceType } from "@/lib/api";

interface EditingState {
  name: string;
  description: string;
  platformFeePercent: number;
  isActive: boolean;
  metadataSchema: string;
}

export default function ServiceTypesPage() {
  const { toast } = useToast();
  const { data: serviceTypes, isLoading } = useAdminServiceTypes();
  const updateServiceType = useUpdateServiceType();
  const createServiceType = useCreateServiceType();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingState, setEditingState] = useState<EditingState | null>(null);

  // New service type dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newServiceType, setNewServiceType] = useState({
    id: '',
    name: '',
    description: '',
    platformFeePercent: 10,
  });

  // Select first service type when data loads
  useEffect(() => {
    if (serviceTypes && serviceTypes.length > 0 && !selectedId) {
      setSelectedId(serviceTypes[0].id);
    }
  }, [serviceTypes, selectedId]);

  const currentService = serviceTypes?.find(s => s.id === selectedId);

  // Initialize editing state when entering edit mode
  useEffect(() => {
    if (isEditing && currentService) {
      setEditingState({
        name: currentService.name,
        description: currentService.description || '',
        platformFeePercent: currentService.platformFeePercent,
        isActive: currentService.isActive,
        metadataSchema: currentService.metadataSchema
          ? JSON.stringify(currentService.metadataSchema, null, 2)
          : '{}',
      });
    } else {
      setEditingState(null);
    }
  }, [isEditing, currentService]);

  const handleSave = async () => {
    if (!editingState || !selectedId) return;

    let metadataSchema: Record<string, string> | undefined;
    try {
      metadataSchema = JSON.parse(editingState.metadataSchema);
    } catch {
      toast({
        title: "Invalid JSON",
        description: "The metadata schema must be valid JSON.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateServiceType.mutateAsync({
        id: selectedId,
        data: {
          name: editingState.name,
          description: editingState.description || undefined,
          platformFeePercent: editingState.platformFeePercent,
          isActive: editingState.isActive,
          metadataSchema,
        },
      });
      toast({
        title: "Saved",
        description: "Service type configuration updated successfully.",
      });
      setIsEditing(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const handleCreate = async () => {
    if (!newServiceType.id.trim() || !newServiceType.name.trim()) {
      toast({
        title: "Missing fields",
        description: "ID and Name are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createServiceType.mutateAsync({
        id: newServiceType.id.toUpperCase().replace(/\s+/g, '_'),
        name: newServiceType.name,
        description: newServiceType.description || undefined,
        platformFeePercent: newServiceType.platformFeePercent,
      });
      toast({
        title: "Created",
        description: "New service type created successfully.",
      });
      setShowCreateDialog(false);
      setNewServiceType({ id: '', name: '', description: '', platformFeePercent: 10 });
      setSelectedId(newServiceType.id.toUpperCase().replace(/\s+/g, '_'));
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create service type",
        variant: "destructive",
      });
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingState(null);
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Service Type Configuration"
        description="Configure dynamic fields and validation rules for each service type."
      >
        <div className="space-y-4">
          <Skeleton className="h-10 w-[300px]" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Service Type Configuration"
      description="Configure dynamic fields and validation rules for each service type."
    >
      <div className="grid gap-6">
        {/* Service Selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {serviceTypes?.map((service) => (
              <Button
                key={service.id}
                variant={selectedId === service.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    toast({
                      title: "Unsaved changes",
                      description: "Save or cancel your changes before switching.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setSelectedId(service.id);
                }}
                className="relative"
              >
                {service.name}
                {!service.isActive && (
                  <Badge variant="secondary" className="ml-2 text-xs">Inactive</Badge>
                )}
              </Button>
            ))}
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Create New Service Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Service Type</DialogTitle>
                <DialogDescription>
                  Define a new type of escrow service that users can create.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-id">Service ID</Label>
                  <Input
                    id="new-id"
                    placeholder="e.g., CONSULTING_ESCROW"
                    value={newServiceType.id}
                    onChange={(e) => setNewServiceType(prev => ({
                      ...prev,
                      id: e.target.value.toUpperCase().replace(/\s+/g, '_')
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier (will be uppercase with underscores)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-name">Display Name</Label>
                  <Input
                    id="new-name"
                    placeholder="e.g., Consulting Escrow"
                    value={newServiceType.name}
                    onChange={(e) => setNewServiceType(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-desc">Description</Label>
                  <Textarea
                    id="new-desc"
                    placeholder="Describe what this service type is for..."
                    value={newServiceType.description}
                    onChange={(e) => setNewServiceType(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-fee">Platform Fee (%)</Label>
                  <Input
                    id="new-fee"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={newServiceType.platformFeePercent}
                    onChange={(e) => setNewServiceType(prev => ({
                      ...prev,
                      platformFeePercent: parseFloat(e.target.value) || 0
                    }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createServiceType.isPending}>
                  {createServiceType.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Service Type
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Configuration Editor */}
        {currentService ? (
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {currentService.name}
                  {!currentService.isActive && (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-1">
                  ID: {currentService.id}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={cancelEdit}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={updateServiceType.isPending}>
                      {updateServiceType.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit Config
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Base Settings */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={isEditing ? editingState?.name : currentService.name}
                    onChange={(e) => setEditingState(prev => prev ? { ...prev, name: e.target.value } : null)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Platform Fee (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={isEditing ? editingState?.platformFeePercent : currentService.platformFeePercent}
                    onChange={(e) => setEditingState(prev => prev ? {
                      ...prev,
                      platformFeePercent: parseFloat(e.target.value) || 0
                    } : null)}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={isEditing ? editingState?.description : (currentService.description || '')}
                  onChange={(e) => setEditingState(prev => prev ? { ...prev, description: e.target.value } : null)}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={isEditing ? editingState?.isActive : currentService.isActive}
                  onCheckedChange={(checked) => setEditingState(prev => prev ? { ...prev, isActive: checked } : null)}
                  disabled={!isEditing}
                />
                <Label>Service Type Active</Label>
                {!(isEditing ? editingState?.isActive : currentService.isActive) && (
                  <span className="text-sm text-muted-foreground">
                    (Users cannot create new escrows of this type)
                  </span>
                )}
              </div>

              <Separator />

              {/* Party Deliverables */}
              <div>
                <h3 className="text-lg font-medium mb-4">Party Deliverables</h3>
                <div className="grid grid-cols-2 gap-6">
                  <Card className="bg-slate-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Party A Delivers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{currentService.partyADelivers?.type || 'N/A'}</Badge>
                        <span className="text-sm">{currentService.partyADelivers?.label || 'Not configured'}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Party B Delivers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{currentService.partyBDelivers?.type || 'N/A'}</Badge>
                        <span className="text-sm">{currentService.partyBDelivers?.label || 'Not configured'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Separator />

              {/* Confirmation Rules */}
              <div>
                <h3 className="text-lg font-medium mb-4">Confirmation Rules</h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    {currentService.requiresPartyAConfirmation ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Requires Party A Confirmation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentService.requiresPartyBConfirmation ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Requires Party B Confirmation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentService.autoAcceptable ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Auto-Acceptable by Providers</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Metadata Schema */}
              <div>
                <h3 className="text-lg font-medium mb-2">Metadata Schema</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  JSON schema defining what extra data is required when creating escrows of this type.
                </p>
                <Textarea
                  value={isEditing
                    ? editingState?.metadataSchema
                    : JSON.stringify(currentService.metadataSchema || {}, null, 2)}
                  onChange={(e) => setEditingState(prev => prev ? { ...prev, metadataSchema: e.target.value } : null)}
                  disabled={!isEditing}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              {/* Created At */}
              <div className="text-sm text-muted-foreground">
                Created: {new Date(currentService.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>No service types found. Create one to get started.</p>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
