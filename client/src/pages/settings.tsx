import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer className="max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Account Settings</h1>

        <Tabs defaultValue="auto-accept" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="auto-accept">Auto-Accept Rules</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="auto-accept">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">Auto-Acceptance Rules</h2>
                  <p className="text-sm text-muted-foreground">
                    Automatically accept incoming escrow requests that meet specific criteria.
                  </p>
                </div>
                <Button>
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

              {/* Rules List */}
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="pb-3">
                     <div className="flex justify-between items-start">
                       <div>
                         <CardTitle className="text-base">Traffic Buy - Small Orders</CardTitle>
                         <CardDescription>Auto-accept standard traffic requests under $500</CardDescription>
                       </div>
                       <Switch defaultChecked />
                     </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                       <div>
                         <span className="text-muted-foreground block text-xs mb-1">Service Type</span>
                         <span className="font-medium">TRAFFIC_BUY</span>
                       </div>
                       <div>
                         <span className="text-muted-foreground block text-xs mb-1">Max Amount</span>
                         <span className="font-mono font-medium">$500.00 USD</span>
                       </div>
                       <div className="flex justify-end items-center">
                         <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                           <Trash2 className="h-4 w-4 mr-2" /> Delete
                         </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                     <div className="flex justify-between items-start">
                       <div>
                         <CardTitle className="text-base">API Key Exchange</CardTitle>
                         <CardDescription>Always accept key exchanges from verified orgs</CardDescription>
                       </div>
                       <Switch defaultChecked />
                     </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                       <div>
                         <span className="text-muted-foreground block text-xs mb-1">Service Type</span>
                         <span className="font-medium">API_KEY_EXCHANGE</span>
                       </div>
                       <div>
                         <span className="text-muted-foreground block text-xs mb-1">Max Amount</span>
                         <span className="font-mono font-medium">Any Amount</span>
                       </div>
                       <div className="flex justify-end items-center">
                         <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                           <Trash2 className="h-4 w-4 mr-2" /> Delete
                         </Button>
                       </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input defaultValue="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input defaultValue="john@example.com" />
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
