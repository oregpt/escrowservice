import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

export default function EscrowNew() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();

  const handleNext = () => setStep(step + 1);
  const handleSubmit = () => setLocation("/");

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Header />
      <PageContainer className="max-w-3xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Create New Escrow</h1>
          <p className="text-muted-foreground mt-2">Set up a secure transaction with defined conditions.</p>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`
                h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border
                ${step === s ? 'bg-primary text-primary-foreground border-primary' : 
                  step > s ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-background text-muted-foreground'}
              `}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              <span className={`text-sm ${step === s ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Type & Details' : s === 2 ? 'Terms' : 'Review'}
              </span>
              {s < 3 && <div className="w-12 h-px bg-border mx-2" />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{step === 1 ? 'Transaction Details' : step === 2 ? 'Terms & Conditions' : 'Review & Confirm'}</CardTitle>
            <CardDescription>
              {step === 1 ? 'Select the type of service and amount.' : 
               step === 2 ? 'Define what needs to happen for funds to be released.' : 
               'Please verify all details before creating the escrow.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select defaultValue="TRAFFIC_BUY">
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRAFFIC_BUY">Traffic Buy (Canton Network)</SelectItem>
                      <SelectItem value="DOCUMENT_DELIVERY">Document Delivery</SelectItem>
                      <SelectItem value="API_KEY_EXCHANGE">API Key Exchange</SelectItem>
                      <SelectItem value="CUSTOM">Custom Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input placeholder="0.00" className="pl-7 font-mono" defaultValue="100.00" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Counterparty Email (Optional)</Label>
                    <Input placeholder="provider@example.com" />
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-blue-900">Buyer Protection</h4>
                    <p className="text-sm text-blue-700">Funds are held securely in escrow until you verify the service delivery.</p>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Describe exactly what needs to be delivered..." className="min-h-[100px]" />
                </div>
                
                <div className="space-y-2">
                  <Label>Auto-Expiry</Label>
                  <Select defaultValue="7d">
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24 Hours</SelectItem>
                      <SelectItem value="3d">3 Days</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">If not accepted by then, funds return to your wallet.</p>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg space-y-3 border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">Traffic Buy</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-mono font-bold">$100.00 USD</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee (1%)</span>
                    <span className="font-mono">$1.00 USD</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-base">
                    <span className="font-medium">Total Required</span>
                    <span className="font-mono font-bold">$101.00 USD</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>Previous</Button>
              ) : (
                <div />
              )}
              
              {step < 3 ? (
                <Button onClick={handleNext}>Next Step</Button>
              ) : (
                <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700">Create & Fund Escrow</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
