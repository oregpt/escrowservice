import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { useState } from "react";

type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';

interface CustomField {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  required: boolean;
}

interface ServiceTypeConfig {
  id: string;
  name: string;
  description: string;
  baseFeePercent: number;
  fields: CustomField[];
}

export default function ServiceTypesPage() {
  const [selectedService, setSelectedService] = useState<string>("TRAFFIC_BUY");
  const [isEditing, setIsEditing] = useState(false);

  // Mock Config Data
  const [serviceConfigs, setServiceConfigs] = useState<Record<string, ServiceTypeConfig>>({
    TRAFFIC_BUY: {
      id: "TRAFFIC_BUY",
      name: "Traffic Buy",
      description: "Purchase of Canton Network traffic for validator nodes.",
      baseFeePercent: 1.5,
      fields: [
        { id: "f1", name: "Validator Party ID", key: "validatorPartyId", type: "text", required: true },
        { id: "f2", name: "Minimum Uptime %", key: "minUptime", type: "number", required: true },
      ]
    },
    DOCUMENT_DELIVERY: {
      id: "DOCUMENT_DELIVERY",
      name: "Document Delivery",
      description: "Secure delivery of sensitive documents.",
      baseFeePercent: 2.0,
      fields: [
        { id: "f1", name: "Encryption Standard", key: "encryption", type: "select", required: true },
      ]
    }
  });

  const currentConfig = serviceConfigs[selectedService];

  return (
    <AdminLayout 
      title="Service Type Configuration" 
      description="Configure dynamic fields and validation rules for each service type."
    >
      <div className="grid gap-6">
        {/* Service Selector */}
        <div className="flex items-center gap-4">
          <div className="w-[300px]">
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Select Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRAFFIC_BUY">Traffic Buy</SelectItem>
                <SelectItem value="DOCUMENT_DELIVERY">Document Delivery</SelectItem>
                <SelectItem value="API_KEY_EXCHANGE">API Key Exchange</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Create New Service Type
          </Button>
        </div>

        {/* Configuration Editor */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">{currentConfig?.name}</CardTitle>
              <CardDescription>{currentConfig?.description}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={isEditing ? "default" : "outline"} 
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? <Save className="mr-2 h-4 w-4" /> : <Edit2 className="mr-2 h-4 w-4" />}
                {isEditing ? "Save Changes" : "Edit Config"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            
            {/* Base Settings */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input defaultValue={currentConfig?.name} disabled={!isEditing} />
              </div>
              <div className="space-y-2">
                <Label>Platform Fee (%)</Label>
                <Input type="number" defaultValue={currentConfig?.baseFeePercent} disabled={!isEditing} />
              </div>
            </div>

            <Separator />

            {/* Dynamic Fields Configuration */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Dynamic Fields</h3>
                {isEditing && (
                  <Button size="sm" variant="secondary">
                    <Plus className="mr-2 h-4 w-4" /> Add Field
                  </Button>
                )}
              </div>

              <div className="bg-slate-50 rounded-lg border divide-y">
                {currentConfig?.fields.map((field) => (
                  <div key={field.id} className="p-4 flex items-center gap-4">
                    <div className="grid grid-cols-4 gap-4 flex-1">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Field Label</Label>
                        <Input value={field.name} disabled={!isEditing} className="h-8 bg-white" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Field Key (JSON)</Label>
                        <Input value={field.key} disabled={!isEditing} className="h-8 bg-white font-mono text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Data Type</Label>
                         <Select value={field.type} disabled={!isEditing}>
                          <SelectTrigger className="h-8 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="boolean">Boolean (Switch)</SelectItem>
                            <SelectItem value="select">Dropdown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                         <Switch checked={field.required} disabled={!isEditing} />
                         <span className="text-sm text-muted-foreground">Required</span>
                      </div>
                    </div>
                    
                    {isEditing && (
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {currentConfig?.fields.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No custom fields configured for this service type.
                  </div>
                )}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
