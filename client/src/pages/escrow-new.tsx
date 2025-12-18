import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Shield, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useCreateEscrow, useServiceTypes } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import type { ServiceTypeId, CreateEscrowRequest } from "@/lib/api";

const EXPIRY_OPTIONS: Record<string, number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '30d': 30,
};

export default function EscrowNew() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Form state
  const [serviceType, setServiceType] = useState<ServiceTypeId>('TRAFFIC_BUY');
  const [amount, setAmount] = useState('100.00');
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  const [description, setDescription] = useState('');
  const [expiryDays, setExpiryDays] = useState('7d');

  // Traffic Buy specific fields
  const [validatorPartyId, setValidatorPartyId] = useState('');
  const [domainId, setDomainId] = useState('');

  // API
  const { data: serviceTypes } = useServiceTypes();
  const createEscrow = useCreateEscrow();

  const currentServiceType = serviceTypes?.find(st => st.id === serviceType);
  const platformFeePercent = currentServiceType?.platformFeePercent || 15;
  const amountNum = parseFloat(amount) || 0;
  const platformFee = amountNum * (platformFeePercent / 100);
  const totalAmount = amountNum + platformFee;

  // For traffic buy: calculate bytes
  const trafficBytes = Math.floor((amountNum / 60) * 1_000_000);

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    try {
      const metadata: Record<string, any> = { description };

      // Add service-specific metadata
      if (serviceType === 'TRAFFIC_BUY') {
        if (!validatorPartyId || !domainId) {
          toast({
            title: "Missing Fields",
            description: "Validator Party ID and Domain ID are required for Traffic Buy",
            variant: "destructive",
          });
          return;
        }
        metadata.validatorPartyId = validatorPartyId;
        metadata.domainId = domainId;
        metadata.trafficAmountBytes = trafficBytes;
      }

      const request: CreateEscrowRequest = {
        serviceTypeId: serviceType,
        amount: amountNum,
        currency: 'USD',
        expiresInDays: EXPIRY_OPTIONS[expiryDays],
        metadata,
      };

      const result = await createEscrow.mutateAsync(request);

      toast({
        title: "Escrow Created",
        description: `Escrow ${result?.id} has been created successfully.`,
      });

      setLocation(`/escrow/${result?.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create escrow",
        variant: "destructive",
      });
    }
  };

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
                  <Select value={serviceType} onValueChange={(v) => setServiceType(v as ServiceTypeId)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes?.filter(st => st.isActive).map(st => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name}
                        </SelectItem>
                      )) || (
                          <>
                            <SelectItem value="TRAFFIC_BUY">Traffic Buy (Canton Network)</SelectItem>
                            <SelectItem value="DOCUMENT_DELIVERY">Document Delivery</SelectItem>
                            <SelectItem value="API_KEY_EXCHANGE">API Key Exchange</SelectItem>
                            <SelectItem value="CUSTOM">Custom Service</SelectItem>
                          </>
                        )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (USD)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input
                        placeholder="0.00"
                        className="pl-7 font-mono"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Counterparty Email (Optional)</Label>
                    <Input
                      placeholder="provider@example.com"
                      value={counterpartyEmail}
                      onChange={(e) => setCounterpartyEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Traffic Buy specific fields */}
                {serviceType === 'TRAFFIC_BUY' && (
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium text-sm">Canton Network Details</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label>Validator Party ID</Label>
                        <Input
                          placeholder="party-123abc..."
                          value={validatorPartyId}
                          onChange={(e) => setValidatorPartyId(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Domain ID</Label>
                        <Input
                          placeholder="domain-xyz..."
                          value={domainId}
                          onChange={(e) => setDomainId(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="bg-slate-50 p-3 rounded text-sm">
                        <span className="text-muted-foreground">Traffic Amount: </span>
                        <span className="font-mono font-medium">{trafficBytes.toLocaleString()} bytes</span>
                        <span className="text-muted-foreground"> ({(trafficBytes / 1_000_000).toFixed(2)} MB)</span>
                      </div>
                    </div>
                  </div>
                )}

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
                  <Textarea
                    placeholder="Describe exactly what needs to be delivered..."
                    className="min-h-[100px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Auto-Expiry</Label>
                  <Select value={expiryDays} onValueChange={setExpiryDays}>
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
                    <span className="font-medium">{currentServiceType?.name || serviceType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-mono font-bold">${amountNum.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee ({platformFeePercent}%)</span>
                    <span className="font-mono">${platformFee.toFixed(2)} USD</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-base">
                    <span className="font-medium">Total Required</span>
                    <span className="font-mono font-bold">${totalAmount.toFixed(2)} USD</span>
                  </div>
                </div>

                {serviceType === 'TRAFFIC_BUY' && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 border">
                    <h4 className="font-medium text-sm">Canton Details</h4>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Validator: </span>
                      <span className="font-mono text-xs">{validatorPartyId || 'Not set'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Domain: </span>
                      <span className="font-mono text-xs">{domainId || 'Not set'}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Traffic: </span>
                      <span className="font-mono">{trafficBytes.toLocaleString()} bytes</span>
                    </div>
                  </div>
                )}

                {description && (
                  <div className="bg-slate-50 p-4 rounded-lg border">
                    <h4 className="font-medium text-sm mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Expires in: {EXPIRY_OPTIONS[expiryDays]} day(s)
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack}>Previous</Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button onClick={handleNext}>Next Step</Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={createEscrow.isPending}
                >
                  {createEscrow.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Escrow'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}
