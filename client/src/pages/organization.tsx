import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Building2, UserPlus, Settings, MoreHorizontal } from "lucide-react";
import { AccountSummary } from "@/components/account/AccountSummary";

export default function OrganizationPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
           <div className="flex items-center gap-4">
             <div className="h-16 w-16 bg-slate-900 rounded-xl flex items-center justify-center text-white">
               <Building2 className="h-8 w-8" />
             </div>
             <div>
               <h1 className="text-3xl font-bold tracking-tight">MPC Holdings</h1>
               <div className="flex items-center gap-2 mt-1">
                 <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">Verified Business</Badge>
                 <span className="text-sm text-muted-foreground">ID: org_mpc_holdings_v1</span>
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
                totalBalance={50000.00}
                availableBalance={45000.00}
                inContractBalance={5000.00}
                currency="USD"
               />
               
               <Card>
                 <CardHeader>
                   <CardTitle>Organization Stats</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-muted-foreground">Total Escrows</span>
                      <span className="font-bold text-lg">142</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-muted-foreground">Active Disputes</span>
                      <Badge variant="secondary">0</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground">Success Rate</span>
                      <span className="font-bold text-lg text-emerald-600">99.8%</span>
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
                <div className="space-y-4">
                  {[
                    { name: 'John Doe', role: 'Owner', email: 'john@mpc.com' },
                    { name: 'Sarah Smith', role: 'Admin', email: 'sarah@mpc.com' },
                    { name: 'Mike Jones', role: 'Member', email: 'mike@mpc.com' },
                  ].map((member, i) => (
                    <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{member.role}</Badge>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings">
             <Card>
               <CardContent className="pt-6">
                 <p className="text-muted-foreground">Settings content placeholder...</p>
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>

      </PageContainer>
    </div>
  );
}
