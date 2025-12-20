import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Check, Shield, Loader2, Users, User, Globe, Mail, Building, Scale, Gavel, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { useCreateEscrow, useServiceTypes } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import type { ServiceTypeId, CreateEscrowRequest, PrivacyLevel, ArbiterType } from "@/lib/api";
import { Lock, Eye, Building2 } from "lucide-react";

const EXPIRY_OPTIONS: Record<string, number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

const STEP_TITLES = [
  { title: 'Type & Details', description: 'Select the type of service and configure details.' },
  { title: 'Counterparty', description: 'Define who will fulfill this escrow.' },
  { title: 'Terms', description: 'Set the terms and conditions for the transaction.' },
  { title: 'Review & Confirm', description: 'Please verify all details before creating.' },
];

export default function EscrowNew() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Step 1: Type & Details
  const [serviceType, setServiceType] = useState<ServiceTypeId>('CUSTOM');
  const [amount, setAmount] = useState('100.00');
  const [title, setTitle] = useState('');
  // Dynamic metadata fields
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});

  // Step 2: Counterparty
  const [counterpartyType, setCounterpartyType] = useState<'open' | 'specific'>('specific');
  const [specificType, setSpecificType] = useState<'email' | 'organization'>('email');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [counterpartyEmail, setCounterpartyEmail] = useState('');
  const [counterpartyOrgId, setCounterpartyOrgId] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('platform');

  // Step 2b: Arbiter (dispute resolution)
  const [arbiterType, setArbiterType] = useState<ArbiterType>('platform_only');
  const [arbiterOrgId, setArbiterOrgId] = useState('');
  const [arbiterEmail, setArbiterEmail] = useState('');

  // Step 3: Terms
  const [description, setDescription] = useState('');
  const [terms, setTerms] = useState('');
  const [expiryDays, setExpiryDays] = useState('7d');

  // API
  const { data: serviceTypes } = useServiceTypes();
  const createEscrow = useCreateEscrow();

  const currentServiceType = serviceTypes?.find(st => st.id === serviceType);
  const platformFeePercent = currentServiceType?.platformFeePercent || 15;
  const amountNum = parseFloat(amount) || 0;
  const platformFee = amountNum * (platformFeePercent / 100);
  const totalAmount = amountNum + platformFee;

  // Parse metadata schema for dynamic fields
  const metadataSchema = useMemo(() => {
    if (!currentServiceType?.metadataSchema) return {};
    return currentServiceType.metadataSchema as Record<string, string>;
  }, [currentServiceType]);

  // For traffic buy: calculate bytes
  const trafficBytes = useMemo(() => {
    if (serviceType === 'TRAFFIC_BUY' && metadataValues.trafficAmountBytes) {
      return parseInt(metadataValues.trafficAmountBytes) || 0;
    }
    return Math.floor((amountNum / 60) * 1_000_000);
  }, [serviceType, amountNum, metadataValues.trafficAmountBytes]);

  const isOpen = counterpartyType === 'open';

  const handleMetadataChange = (key: string, value: string) => {
    setMetadataValues(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    // Validation for each step
    if (step === 1) {
      if (!serviceType) {
        toast({ title: "Required", description: "Please select a service type", variant: "destructive" });
        return;
      }
      if (amountNum <= 0) {
        toast({ title: "Required", description: "Please enter a valid amount", variant: "destructive" });
        return;
      }
      // Validate required metadata fields
      const requiredFields = Object.keys(metadataSchema);
      for (const field of requiredFields) {
        if (!metadataValues[field] && field !== 'trafficAmountBytes') {
          toast({
            title: "Required",
            description: `Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    if (step === 2) {
      if (counterpartyType === 'specific') {
        if (specificType === 'email' && !counterpartyEmail.trim()) {
          toast({ title: "Required", description: "Please enter the counterparty's email", variant: "destructive" });
          return;
        }
        if (specificType === 'organization' && !counterpartyOrgId) {
          toast({ title: "Required", description: "Please select an organization", variant: "destructive" });
          return;
        }
      }
      // Validate arbiter fields
      if (arbiterType === 'platform_ai') {
        toast({ title: "Coming Soon", description: "Platform AI is not yet available. Please select another arbiter option.", variant: "destructive" });
        return;
      }
      if (arbiterType === 'organization' && !arbiterOrgId.trim()) {
        toast({ title: "Required", description: "Please enter the arbiter organization ID", variant: "destructive" });
        return;
      }
      if (arbiterType === 'person' && !arbiterEmail.trim()) {
        toast({ title: "Required", description: "Please enter the arbiter's email", variant: "destructive" });
        return;
      }
    }

    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    try {
      // Build metadata from dynamic fields
      const metadata: Record<string, any> = { ...metadataValues };

      // Auto-calculate traffic bytes for traffic buy
      if (serviceType === 'TRAFFIC_BUY') {
        metadata.trafficAmountBytes = trafficBytes;
      }

      const request: CreateEscrowRequest = {
        serviceTypeId: serviceType,
        amount: amountNum,
        currency: 'USD',
        isOpen,
        counterpartyName: isOpen ? undefined : counterpartyName.trim() || undefined,
        counterpartyEmail: isOpen ? undefined : (specificType === 'email' ? counterpartyEmail.trim() : undefined) || undefined,
        counterpartyOrgId: isOpen ? undefined : (specificType === 'organization' ? counterpartyOrgId : undefined) || undefined,
        privacyLevel,
        // Arbiter (dispute resolution)
        arbiterType,
        arbiterOrgId: arbiterType === 'organization' ? arbiterOrgId.trim() || undefined : undefined,
        arbiterEmail: arbiterType === 'person' ? arbiterEmail.trim() || undefined : undefined,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        terms: terms.trim() || undefined,
        expiresInDays: EXPIRY_OPTIONS[expiryDays],
        metadata,
      };

      const result = await createEscrow.mutateAsync(request);

      toast({
        title: "Escrow Created",
        description: `Escrow ${result?.id?.slice(0, 8)}... has been created successfully.`,
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

  // Render dynamic metadata fields based on service type schema
  const renderMetadataFields = () => {
    const schemaKeys = Object.keys(metadataSchema);
    if (schemaKeys.length === 0) return null;

    return (
      <div className="space-y-4 border-t pt-4 mt-4">
        <h4 className="font-medium text-sm text-muted-foreground">
          {currentServiceType?.name} Details
        </h4>
        <div className="grid grid-cols-1 gap-4">
          {schemaKeys.map((key) => {
            const fieldType = metadataSchema[key];
            const label = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());

            // Skip trafficAmountBytes as it's auto-calculated
            if (key === 'trafficAmountBytes') {
              return (
                <div key={key} className="bg-slate-50 p-3 rounded text-sm">
                  <span className="text-muted-foreground">Traffic Amount: </span>
                  <span className="font-mono font-medium">{trafficBytes.toLocaleString()} bytes</span>
                  <span className="text-muted-foreground"> ({(trafficBytes / 1_000_000).toFixed(2)} MB)</span>
                  <p className="text-xs text-muted-foreground mt-1">Auto-calculated based on amount</p>
                </div>
              );
            }

            return (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                {fieldType === 'integer' || fieldType === 'number' ? (
                  <Input
                    type="number"
                    placeholder={`Enter ${label.toLowerCase()}`}
                    value={metadataValues[key] || ''}
                    onChange={(e) => handleMetadataChange(key, e.target.value)}
                    className="font-mono text-sm"
                  />
                ) : (
                  <Input
                    placeholder={`Enter ${label.toLowerCase()}`}
                    value={metadataValues[key] || ''}
                    onChange={(e) => handleMetadataChange(key, e.target.value)}
                    className="font-mono text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
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

        {/* Steps Indicator */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEP_TITLES.map((s, idx) => {
            const stepNum = idx + 1;
            return (
              <div key={stepNum} className="flex items-center gap-2 flex-shrink-0">
                <div className={`
                  h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border transition-colors
                  ${step === stepNum ? 'bg-primary text-primary-foreground border-primary' :
                    step > stepNum ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-background text-muted-foreground'}
                `}>
                  {step > stepNum ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span className={`text-sm whitespace-nowrap ${step === stepNum ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {s.title}
                </span>
                {stepNum < 4 && <div className="w-8 h-px bg-border mx-1" />}
              </div>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEP_TITLES[step - 1].title}</CardTitle>
            <CardDescription>{STEP_TITLES[step - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Step 1: Type & Details */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Escrow Title (Optional)</Label>
                  <Input
                    placeholder="e.g., API Key Purchase, Document Delivery"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select value={serviceType} onValueChange={(v) => {
                    setServiceType(v as ServiceTypeId);
                    setMetadataValues({}); // Reset metadata when type changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes?.filter(st => st.isActive).map(st => (
                        <SelectItem key={st.id} value={st.id}>
                          <div className="flex flex-col">
                            <span>{st.name}</span>
                          </div>
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
                  {currentServiceType?.description && (
                    <p className="text-xs text-muted-foreground">{currentServiceType.description}</p>
                  )}
                </div>

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
                  <p className="text-xs text-muted-foreground">
                    Platform fee: {platformFeePercent}% (${platformFee.toFixed(2)})
                  </p>
                </div>

                {/* Dynamic metadata fields based on service type */}
                {renderMetadataFields()}

                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-blue-900">Originator Protection</h4>
                    <p className="text-sm text-blue-700">Funds are held securely in escrow until you verify the service delivery.</p>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Counterparty */}
            {step === 2 && (
              <>
                <div className="space-y-4">
                  <Label className="text-base">Who will fulfill this escrow?</Label>
                  <RadioGroup
                    value={counterpartyType}
                    onValueChange={(v) => setCounterpartyType(v as 'open' | 'specific')}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <Label
                      htmlFor="open"
                      className={`
                        flex flex-col items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all
                        ${counterpartyType === 'open' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="open" id="open" />
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-primary" />
                          <span className="font-medium">Open Offer</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        Anyone can view and accept this escrow. Great for public services or when you don't have a specific provider in mind.
                      </p>
                    </Label>

                    <Label
                      htmlFor="specific"
                      className={`
                        flex flex-col items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all
                        ${counterpartyType === 'specific' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="specific" id="specific" />
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium">Specific Entity</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground pl-6">
                        Only the specified entity can accept. They'll receive a notification to join the escrow.
                      </p>
                    </Label>
                  </RadioGroup>
                </div>

                {counterpartyType === 'specific' && (
                  <div className="space-y-4 border-t pt-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <User className="h-4 w-4" />
                      <span>Specify Counterparty</span>
                    </div>

                    {/* Choose between Email or Organization */}
                    <RadioGroup
                      value={specificType}
                      onValueChange={(v) => {
                        setSpecificType(v as 'email' | 'organization');
                        // Clear the other field when switching
                        if (v === 'email') setCounterpartyOrgId('');
                        if (v === 'organization') setCounterpartyEmail('');
                      }}
                      className="grid grid-cols-2 gap-4"
                    >
                      <Label
                        htmlFor="specific-email"
                        className={`
                          flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all
                          ${specificType === 'email' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                        `}
                      >
                        <RadioGroupItem value="email" id="specific-email" />
                        <Mail className="h-4 w-4" />
                        <span className="font-medium">By Email</span>
                      </Label>

                      <Label
                        htmlFor="specific-org"
                        className={`
                          flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all
                          ${specificType === 'organization' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                        `}
                      >
                        <RadioGroupItem value="organization" id="specific-org" />
                        <Building className="h-4 w-4" />
                        <span className="font-medium">By Organization</span>
                      </Label>
                    </RadioGroup>

                    {specificType === 'email' && (
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label>Name (Optional)</Label>
                          <Input
                            placeholder="John Doe"
                            value={counterpartyName}
                            onChange={(e) => setCounterpartyName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Email Address <span className="text-red-500">*</span></Label>
                          <Input
                            type="email"
                            placeholder="provider@example.com"
                            value={counterpartyEmail}
                            onChange={(e) => setCounterpartyEmail(e.target.value)}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Only this specific person will see and can accept this escrow.
                          </p>
                        </div>
                      </div>
                    )}

                    {specificType === 'organization' && (
                      <div className="space-y-2 pt-2">
                        <Label>Organization ID <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="Paste organization ID here..."
                          value={counterpartyOrgId}
                          onChange={(e) => setCounterpartyOrgId(e.target.value)}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Ask the counterparty for their Organization ID (found on their Balances page). Any member of that organization can accept the escrow.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {counterpartyType === 'open' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                    <Users className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-amber-900">Open to All</h4>
                      <p className="text-sm text-amber-700">
                        This escrow will be visible to registered providers. The first qualified provider to accept will become the counterparty.
                      </p>
                    </div>
                  </div>
                )}

                {/* Privacy Level */}
                <div className="space-y-4 border-t pt-6">
                  <Label className="text-base">Visibility</Label>
                  <RadioGroup
                    value={privacyLevel}
                    onValueChange={(v) => setPrivacyLevel(v as PrivacyLevel)}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    <Label
                      htmlFor="privacy-public"
                      className={`
                        flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                        ${privacyLevel === 'public' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="public" id="privacy-public" />
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Public</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Anyone can view this escrow
                      </p>
                    </Label>

                    <Label
                      htmlFor="privacy-platform"
                      className={`
                        flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                        ${privacyLevel === 'platform' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="platform" id="privacy-platform" />
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Platform</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Only authenticated users can view
                      </p>
                    </Label>

                    <Label
                      htmlFor="privacy-private"
                      className={`
                        flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                        ${privacyLevel === 'private' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="private" id="privacy-private" />
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-red-600" />
                          <span className="font-medium">Private</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Only parties involved can view
                      </p>
                    </Label>
                  </RadioGroup>
                </div>

                {/* Arbiter / Dispute Resolution */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-amber-600" />
                    <Label className="text-base">Dispute Resolution</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choose who can resolve disputes if they arise. Platform always retains override ability.
                  </p>
                  <RadioGroup
                    value={arbiterType}
                    onValueChange={(v) => {
                      setArbiterType(v as ArbiterType);
                      // Clear other fields when switching
                      if (v !== 'organization') setArbiterOrgId('');
                      if (v !== 'person') setArbiterEmail('');
                    }}
                    className="grid grid-cols-1 gap-3"
                  >
                    <Label
                      htmlFor="arbiter-platform"
                      className={`
                        flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                        ${arbiterType === 'platform_only' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="platform_only" id="arbiter-platform" />
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Platform Only (Recommended)</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Platform admin handles all disputes. Simplest option for most escrows.
                      </p>
                    </Label>

                    <Label
                      htmlFor="arbiter-ai"
                      className={`
                        flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                        ${arbiterType === 'platform_ai' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="platform_ai" id="arbiter-ai" />
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-violet-600" />
                          <span className="font-medium">Platform AI</span>
                          <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">Coming Soon</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        AI-powered dispute resolution with automated analysis and recommendations.
                      </p>
                    </Label>

                    <Label
                      htmlFor="arbiter-org"
                      className={`
                        flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                        ${arbiterType === 'organization' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="organization" id="arbiter-org" />
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">Third-Party Organization</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Any admin of the specified organization can resolve disputes.
                      </p>
                    </Label>

                    <Label
                      htmlFor="arbiter-person"
                      className={`
                        flex flex-col items-start gap-2 rounded-lg border p-4 cursor-pointer transition-all
                        ${arbiterType === 'person' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="person" id="arbiter-person" />
                        <div className="flex items-center gap-2">
                          <Gavel className="h-4 w-4 text-amber-600" />
                          <span className="font-medium">Specific Person</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        A specific individual can resolve disputes (by email).
                      </p>
                    </Label>
                  </RadioGroup>

                  {arbiterType === 'platform_ai' && (
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-5 w-5 text-violet-600" />
                        <h4 className="font-medium text-violet-900">Coming Soon</h4>
                      </div>
                      <p className="text-sm text-violet-700">
                        Platform AI dispute resolution is currently in development. This feature will use AI to analyze escrow details,
                        communication history, and attachments to provide fair and automated dispute resolution.
                      </p>
                      <p className="text-xs text-violet-600 mt-2">
                        Please select another arbiter option for now.
                      </p>
                    </div>
                  )}

                  {arbiterType === 'organization' && (
                    <div className="space-y-2 pt-2 pl-6">
                      <Label>Arbiter Organization ID <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="Paste organization ID here..."
                        value={arbiterOrgId}
                        onChange={(e) => setArbiterOrgId(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Any admin of this organization can cancel or force-complete the escrow if a dispute arises.
                      </p>
                    </div>
                  )}

                  {arbiterType === 'person' && (
                    <div className="space-y-2 pt-2 pl-6">
                      <Label>Arbiter Email <span className="text-red-500">*</span></Label>
                      <Input
                        type="email"
                        placeholder="arbiter@example.com"
                        value={arbiterEmail}
                        onChange={(e) => setArbiterEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        This person can cancel or force-complete the escrow if a dispute arises.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 3: Terms */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe exactly what needs to be delivered..."
                    className="min-h-[100px]"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific about deliverables, quality expectations, and any requirements.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Terms & Conditions (Optional)</Label>
                  <Textarea
                    placeholder="Add any specific terms, conditions, or agreements..."
                    className="min-h-[100px]"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include payment terms, revision policies, or other agreements both parties should follow.
                  </p>
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
                      <SelectItem value="14d">14 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    If not accepted by then, funds return to your wallet automatically.
                  </p>
                </div>
              </>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-4">
                {/* Service Details */}
                <div className="bg-slate-50 p-4 rounded-lg space-y-3 border">
                  <h4 className="font-medium text-sm border-b pb-2">Service Details</h4>
                  {title && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium">{title}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{currentServiceType?.name || serviceType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-mono font-bold">${amountNum.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fee ({platformFeePercent}%)</span>
                    <span className="font-mono">${platformFee.toFixed(2)} USD</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-base">
                    <span className="font-medium">Total Required</span>
                    <span className="font-mono font-bold text-primary">${totalAmount.toFixed(2)} USD</span>
                  </div>
                </div>

                {/* Service-specific metadata */}
                {Object.keys(metadataValues).length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 border">
                    <h4 className="font-medium text-sm border-b pb-2">{currentServiceType?.name} Details</h4>
                    {Object.entries(metadataValues).map(([key, value]) => {
                      if (!value) return null;
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      return (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono text-xs truncate max-w-[200px]">{value}</span>
                        </div>
                      );
                    })}
                    {serviceType === 'TRAFFIC_BUY' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Traffic Amount</span>
                        <span className="font-mono">{trafficBytes.toLocaleString()} bytes</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Counterparty */}
                <div className="bg-slate-50 p-4 rounded-lg space-y-2 border">
                  <h4 className="font-medium text-sm border-b pb-2">Counterparty</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium flex items-center gap-1">
                      {isOpen ? (
                        <><Globe className="h-3 w-3" /> Open Offer</>
                      ) : specificType === 'organization' ? (
                        <><Building className="h-3 w-3" /> Organization</>
                      ) : (
                        <><User className="h-3 w-3" /> Specific Person</>
                      )}
                    </span>
                  </div>
                  {!isOpen && counterpartyName && specificType === 'email' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Name</span>
                      <span>{counterpartyName}</span>
                    </div>
                  )}
                  {!isOpen && counterpartyEmail && specificType === 'email' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-mono text-xs">{counterpartyEmail}</span>
                    </div>
                  )}
                  {!isOpen && counterpartyOrgId && specificType === 'organization' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Organization ID</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {counterpartyOrgId}
                      </span>
                    </div>
                  )}
                </div>

                {/* Arbiter / Dispute Resolution */}
                <div className="bg-slate-50 p-4 rounded-lg space-y-2 border">
                  <h4 className="font-medium text-sm border-b pb-2 flex items-center gap-2">
                    <Scale className="h-4 w-4 text-amber-600" />
                    Dispute Resolution
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Arbiter</span>
                    <span className="font-medium flex items-center gap-1">
                      {arbiterType === 'platform_only' ? (
                        <><Shield className="h-3 w-3" /> Platform</>
                      ) : arbiterType === 'organization' ? (
                        <><Building className="h-3 w-3" /> Organization</>
                      ) : (
                        <><Gavel className="h-3 w-3" /> Specific Person</>
                      )}
                    </span>
                  </div>
                  {arbiterType === 'organization' && arbiterOrgId && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Organization ID</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {arbiterOrgId}
                      </span>
                    </div>
                  )}
                  {arbiterType === 'person' && arbiterEmail && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-mono text-xs">{arbiterEmail}</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">
                    Platform admin always retains override ability.
                  </p>
                </div>

                {/* Terms */}
                {(description || terms) && (
                  <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                    <h4 className="font-medium text-sm border-b pb-2">Terms</h4>
                    {description && (
                      <div>
                        <span className="text-sm text-muted-foreground">Description:</span>
                        <p className="text-sm mt-1">{description}</p>
                      </div>
                    )}
                    {terms && (
                      <div>
                        <span className="text-sm text-muted-foreground">Conditions:</span>
                        <p className="text-sm mt-1">{terms}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between text-sm text-muted-foreground border-t pt-4">
                  <span>Expires in:</span>
                  <span>{EXPIRY_OPTIONS[expiryDays]} day(s)</span>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack}>
                  Previous
                </Button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <Button onClick={handleNext}>
                  Next Step
                </Button>
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
