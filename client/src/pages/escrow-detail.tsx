import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { EscrowTimeline } from "@/components/escrow/EscrowTimeline";
import { PartyInfo } from "@/components/escrow/PartyInfo";
import { AttachmentList, type Attachment } from "@/components/attachments/AttachmentList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, AlertCircle, CheckCircle } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function EscrowDetail() {
  const [, params] = useRoute("/escrow/:id");
  const id = params?.id || "esc_12345678";

  // Mock Data
  const escrowData = {
    id,
    status: 'FUNDED' as const,
    amount: 100.00,
    currency: 'USD',
    serviceType: 'TRAFFIC_BUY',
    createdAt: 'Dec 18, 2025',
    description: "Purchase of Canton Network traffic for validator node 0x123...abc. Requires guaranteed uptime of 99.9% for the duration of the test.",
    attachments: [
      {
        id: '1',
        name: 'Service_Agreement_v1.pdf',
        type: 'pdf',
        size: '2.4 MB',
        uploadedBy: 'John Doe',
        date: 'Dec 18, 2025',
        status: 'released'
      },
      {
        id: '2',
        name: 'Access_Credentials.enc',
        type: 'code',
        size: '4 KB',
        uploadedBy: 'Ore Provider',
        date: 'Dec 19, 2025',
        status: 'locked'
      }
    ] as Attachment[]
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer>
        <Link href="/">
          <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight font-mono">{escrowData.id}</h1>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                FUNDED
              </Badge>
            </div>
            <p className="text-muted-foreground">{escrowData.serviceType} • Created on {escrowData.createdAt}</p>
          </div>

          <div className="flex items-center gap-3">
             <Button variant="outline" className="gap-2">
               <MessageSquare className="w-4 h-4" /> Messages
             </Button>
             <Button variant="destructive" size="sm" className="hidden">Dispute</Button>
          </div>
        </div>

        {/* Timeline */}
        <Card className="mb-8 overflow-hidden">
          <CardContent className="pt-10 pb-8 px-8">
            <EscrowTimeline status={escrowData.status} createdAt={escrowData.createdAt} />
          </CardContent>
          <div className="bg-slate-50 border-t p-4 flex items-center gap-3 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Next Action: <strong className="text-foreground">Provider</strong> needs to deliver the service.</span>
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Agreement Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-sm text-slate-600">
                  {escrowData.description}
                </p>
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card>
              <CardHeader>
                <CardTitle>Attachments & Deliverables</CardTitle>
              </CardHeader>
              <CardContent>
                <AttachmentList attachments={escrowData.attachments} />
              </CardContent>
            </Card>

            {/* Action Area */}
            <Card className="border-emerald-100 bg-emerald-50/30">
              <CardHeader>
                <CardTitle className="text-emerald-900">Completion Actions</CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                    <div className="space-y-1">
                      <h4 className="font-medium">Mark as Delivered</h4>
                      <p className="text-xs text-muted-foreground">Are you the provider? Upload proof to unlock funds.</p>
                    </div>
                    <Button disabled className="opacity-50">Mark Delivered</Button>
                 </div>
              </CardContent>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Amount Card */}
            <Card className="bg-slate-900 text-white border-slate-800">
              <CardContent className="pt-6">
                <div className="text-sm text-slate-400 mb-1">Escrow Balance</div>
                <div className="text-3xl font-bold font-mono tracking-tight mb-4">
                  ${escrowData.amount.toFixed(2)} <span className="text-lg text-slate-500 font-sans">USD</span>
                </div>
                <Separator className="bg-slate-700 my-4" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Platform Fee</span>
                  <span>$1.00</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-400">Net to Seller</span>
                  <span className="font-bold text-emerald-400">$99.00</span>
                </div>
              </CardContent>
            </Card>

            {/* Parties */}
            <div className="space-y-3">
               <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider pl-1">Parties Involved</h3>
               <PartyInfo role="Buyer" name="John Doe" email="john@example.com" isCurrentUser status="waiting" />
               <div className="flex justify-center -my-2 relative z-10">
                 <div className="bg-slate-100 rounded-full p-1">
                    <ArrowLeft className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                 </div>
               </div>
               <PartyInfo role="Seller" name="Ore Provider" email="provider@canton.net" status="action_required" />
            </div>

          </div>
        </div>
      </PageContainer>
    </div>
  );
}
