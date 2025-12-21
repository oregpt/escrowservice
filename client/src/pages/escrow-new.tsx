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
import { ArrowLeft, Check, Shield, Loader2, Users, User, Globe, Mail, Building, Scale, Gavel, Bot, FileText, Plus, Pencil, Trash2, Save } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { useCreateEscrow, useServiceTypes, usePublicPlatformSettings, useCCPrice, useTemplates, useCreateTemplate, useRecordTemplateUsage, useDeleteTemplate } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import type { ServiceTypeId, CreateEscrowRequest, PrivacyLevel, ArbiterType, EscrowTemplate, EscrowTemplateConfig } from "@/lib/api";
import { Lock, Eye, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EXPIRY_OPTIONS: Record<string, number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

const STEP_TITLES = [
  { title: 'Choose Template', description: 'Start fresh or use a saved template.' },
  { title: 'Type & Details', description: 'Select the type of service and configure details.' },
  { title: 'Counterparty', description: 'Define who will fulfill this escrow.' },
  { title: 'Terms', description: 'Set the terms and conditions for the transaction.' },
  { title: 'Review & Confirm', description: 'Please verify all details before creating.' },
];

export default function EscrowNew() {
  const [step, setStep] = useState(0); // Start at step 0 (template selection)
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<EscrowTemplate | null>(null);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

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
  const { data: publicSettings } = usePublicPlatformSettings();
  const { data: ccPriceData } = useCCPrice();
  const { data: allTemplates, isLoading: templatesLoading } = useTemplates();
  const createEscrow = useCreateEscrow();
  const createTemplate = useCreateTemplate();
  const recordTemplateUsage = useRecordTemplateUsage();
  const deleteTemplate = useDeleteTemplate();

  // CC (Canton Coin) price - editable with Kaiko as default source
  const [manualCcRate, setManualCcRate] = useState<string>('');
  const ccPriceUsd = manualCcRate ? parseFloat(manualCcRate) : (ccPriceData?.ccPriceUsd || 0.1);
  const ccSource = manualCcRate ? 'manual' : (ccPriceData?.source || 'default');
  const amountInCC = ccPriceUsd > 0 ? parseFloat(amount || '0') / ccPriceUsd : 0;

  // Separate templates into user's and platform
  const userTemplates = allTemplates?.filter(t => !t.isPlatformTemplate) || [];
  const platformTemplates = allTemplates?.filter(t => t.isPlatformTemplate) || [];

  const currentServiceType = serviceTypes?.find(st => st.id === serviceType);
  const amountNum = parseFloat(amount) || 0;

  // Traffic price per MB from platform settings (default $60)
  const trafficPricePerMB = publicSettings?.trafficPricePerMB || 60;

  // Parse metadata schema for dynamic fields
  const metadataSchema = useMemo(() => {
    if (!currentServiceType?.metadataSchema) return {};
    return currentServiceType.metadataSchema as Record<string, string>;
  }, [currentServiceType]);

  // For traffic buy: calculate bytes using configurable price per MB
  const trafficBytes = useMemo(() => {
    if (serviceType === 'TRAFFIC_BUY' && metadataValues.trafficAmountBytes) {
      return parseInt(metadataValues.trafficAmountBytes) || 0;
    }
    // Calculate: amount / pricePerMB * 1,000,000 bytes
    return Math.floor((amountNum / trafficPricePerMB) * 1_000_000);
  }, [serviceType, amountNum, metadataValues.trafficAmountBytes, trafficPricePerMB]);

  const isOpen = counterpartyType === 'open';

  // Load template into form
  const loadTemplate = (template: EscrowTemplate) => {
    const config = template.config;
    setSelectedTemplate(template);

    // Load all values from template config
    if (config.serviceTypeId) setServiceType(config.serviceTypeId as ServiceTypeId);
    if (config.amount !== undefined) setAmount(config.amount.toString());
    if (config.title) setTitle(config.title);
    if (config.metadata) setMetadataValues(config.metadata as Record<string, string>);

    // Counterparty
    if (config.isOpen !== undefined) {
      setCounterpartyType(config.isOpen ? 'open' : 'specific');
    }
    if (config.counterpartyType === 'organization') {
      setSpecificType('organization');
    } else if (config.counterpartyType === 'email') {
      setSpecificType('email');
    }
    if (config.counterpartyName) setCounterpartyName(config.counterpartyName);
    if (config.counterpartyEmail) setCounterpartyEmail(config.counterpartyEmail);
    if (config.counterpartyOrgId) setCounterpartyOrgId(config.counterpartyOrgId);
    if (config.privacyLevel) setPrivacyLevel(config.privacyLevel);

    // Arbiter
    if (config.arbiterType) setArbiterType(config.arbiterType);
    if (config.arbiterOrgId) setArbiterOrgId(config.arbiterOrgId);
    if (config.arbiterEmail) setArbiterEmail(config.arbiterEmail);

    // Terms
    if (config.description) setDescription(config.description);
    if (config.terms) setTerms(config.terms);
    if (config.expiresInDays !== undefined) {
      // Find matching expiry option
      const match = Object.entries(EXPIRY_OPTIONS).find(([, days]) => days === config.expiresInDays);
      if (match) setExpiryDays(match[0]);
    }

    // Record usage
    recordTemplateUsage.mutate(template.id);
  };

  // Build current config for template
  const buildTemplateConfig = (): EscrowTemplateConfig => ({
    serviceTypeId: serviceType,
    amount: amountNum,
    currency: 'USD',
    isOpen,
    counterpartyType: isOpen ? 'open' : specificType,
    counterpartyName: counterpartyName || undefined,
    counterpartyEmail: specificType === 'email' ? counterpartyEmail : undefined,
    counterpartyOrgId: specificType === 'organization' ? counterpartyOrgId : undefined,
    privacyLevel,
    arbiterType,
    arbiterOrgId: arbiterType === 'organization' ? arbiterOrgId : undefined,
    arbiterEmail: arbiterType === 'person' ? arbiterEmail : undefined,
    title: title || undefined,
    description: description || undefined,
    terms: terms || undefined,
    expiresInDays: EXPIRY_OPTIONS[expiryDays],
    metadata: Object.keys(metadataValues).length > 0 ? metadataValues : undefined,
  });

  // Save as template
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: "Required", description: "Please enter a template name", variant: "destructive" });
      return;
    }

    try {
      await createTemplate.mutateAsync({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        serviceTypeId: serviceType,
        config: buildTemplateConfig(),
      });

      toast({ title: "Template Saved", description: "Your template has been saved for future use." });
      setShowSaveTemplateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive"
      });
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTemplate.mutateAsync(templateId);
      toast({ title: "Deleted", description: "Template deleted successfully." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive"
      });
    }
  };

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

      // Auto-populate traffic buy metadata
      if (serviceType === 'TRAFFIC_BUY') {
        metadata.trafficAmountBytes = trafficBytes;
        // Set default domainId if not provided (hidden from UI)
        if (!metadata.domainId) {
          metadata.domainId = 'global::default';
        }
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

    // For TRAFFIC_BUY, always show custom layout regardless of schema
    if (serviceType === 'TRAFFIC_BUY') {
      return (
        <div className="space-y-4 border-t pt-4 mt-4">
          <h4 className="font-medium text-sm text-muted-foreground">
            Canton Traffic Purchase Details
          </h4>
          <div className="grid grid-cols-1 gap-4">
            {/* Validator Party ID - required input */}
            <div className="space-y-2">
              <Label>Validator Party ID <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Enter the validator party ID"
                value={metadataValues.validatorPartyId || ''}
                onChange={(e) => handleMetadataChange('validatorPartyId', e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The validator that should receive this traffic purchase
              </p>
            </div>

            {/* Amount input - moved here to be close to pricing info */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD) <span className="text-red-500">*</span></Label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 text-lg font-mono"
                  placeholder="0.00"
                />
                <span className="text-sm text-muted-foreground">USD</span>
              </div>
            </div>

            {/* Pricing & Conversion Info */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
              {/* CC Price from Kaiko */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  CC Price {ccSource === 'kaiko' ? '(from Kaiko)' : ccSource === 'manual' ? '(manual)' : '(default)'}:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={manualCcRate || ccPriceData?.ccPriceUsd?.toFixed(4) || '0.1000'}
                    onChange={(e) => setManualCcRate(e.target.value)}
                    className="w-24 h-7 text-sm font-mono text-right"
                    placeholder="0.1000"
                  />
                  <span className="text-xs text-muted-foreground">USD/CC</span>
                </div>
              </div>

              {/* Amount in CC */}
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Amount in CC (Canton Coin):</span>
                <span className="font-mono font-medium text-primary">
                  {amountInCC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CC
                </span>
              </div>

              {/* Traffic Price per MB */}
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Traffic Price per MB:</span>
                <span className="font-mono font-medium">${trafficPricePerMB.toFixed(2)} USD</span>
              </div>

              {/* Est. Traffic Amount */}
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Est. Traffic Amount:</span>
                <span className="font-mono font-medium">
                  {trafficBytes.toLocaleString()} bytes ({(trafficBytes / 1_000_000).toFixed(2)} MB)
                </span>
              </div>

              <p className="text-xs text-muted-foreground pt-1">
                CC price is fetched from Kaiko. Edit the rate above to override.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Default rendering for other service types (only if schema exists)
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

            // Skip trafficAmountBytes and domainId as they're auto-handled
            if (key === 'trafficAmountBytes' || key === 'domainId') {
              return null;
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

        {/* Steps Indicator - only show for steps 1-4 */}
        {step > 0 && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {STEP_TITLES.slice(1).map((s, idx) => {
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
        )}

        {/* Step 0: Template Selection */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{STEP_TITLES[0].title}</CardTitle>
              <CardDescription>{STEP_TITLES[0].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Start Fresh Option */}
              <Button
                variant="outline"
                className="w-full h-auto p-6 justify-start gap-4"
                onClick={() => setStep(1)}
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-lg">Start Fresh</div>
                  <div className="text-sm text-muted-foreground">Create a new escrow from scratch</div>
                </div>
              </Button>

              {/* User Templates */}
              {userTemplates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" /> My Templates
                  </h3>
                  <div className="grid gap-2">
                    {userTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="group relative border rounded-lg p-4 hover:border-primary cursor-pointer transition-colors"
                        onClick={() => {
                          loadTemplate(template);
                          setStep(4); // Go directly to review
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              {template.description && (
                                <div className="text-sm text-muted-foreground">{template.description}</div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {template.serviceTypeName && <Badge variant="outline" className="mr-2">{template.serviceTypeName}</Badge>}
                                {template.config.amount && <span>${template.config.amount} USD</span>}
                                {template.useCount > 0 && <span className="ml-2">• Used {template.useCount}x</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadTemplate(template);
                                setStep(1); // Go to edit mode
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => handleDeleteTemplate(template.id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Platform Templates */}
              {platformTemplates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Platform Templates
                  </h3>
                  <div className="grid gap-2">
                    {platformTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="border rounded-lg p-4 hover:border-primary cursor-pointer transition-colors"
                        onClick={() => {
                          loadTemplate(template);
                          setStep(4); // Go directly to review
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            {template.description && (
                              <div className="text-sm text-muted-foreground">{template.description}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {template.serviceTypeName && <Badge variant="outline" className="mr-2">{template.serviceTypeName}</Badge>}
                              {template.config.amount && <span>${template.config.amount} USD</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {templatesLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!templatesLoading && userTemplates.length === 0 && platformTemplates.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No templates yet. Create an escrow and save it as a template for quick reuse.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Form Steps (1-4) */}
        {step > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{STEP_TITLES[step].title}</CardTitle>
            <CardDescription>{STEP_TITLES[step].description}</CardDescription>
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

                {/* Amount input - hidden for TRAFFIC_BUY as it's in the custom layout */}
                {serviceType !== 'TRAFFIC_BUY' && (
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
                )}

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
                        Anyone can view and accept this escrow.
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
                </div>

                {/* Service-specific metadata */}
                {(Object.keys(metadataValues).length > 0 || serviceType === 'TRAFFIC_BUY') && (
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 border">
                    <h4 className="font-medium text-sm border-b pb-2">{currentServiceType?.name} Details</h4>
                    {Object.entries(metadataValues).map(([key, value]) => {
                      // Hide domainId and trafficAmountBytes from review
                      if (!value || key === 'domainId' || key === 'trafficAmountBytes') return null;
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      return (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono text-xs truncate max-w-[200px]">{value}</span>
                        </div>
                      );
                    })}
                    {serviceType === 'TRAFFIC_BUY' && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Traffic Price per MB</span>
                          <span className="font-mono">${trafficPricePerMB.toFixed(2)} USD</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Est. Traffic Amount</span>
                          <span className="font-mono">{trafficBytes.toLocaleString()} bytes ({(trafficBytes / 1_000_000).toFixed(2)} MB)</span>
                        </div>
                      </>
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
              ) : step === 1 ? (
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Templates
                </Button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <Button onClick={handleNext}>
                  Next Step
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSaveTemplateDialog(true)}
                    disabled={createEscrow.isPending}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save as Template
                  </Button>
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Save as Template Dialog */}
        <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save as Template</DialogTitle>
              <DialogDescription>
                Save this escrow configuration as a template for quick reuse.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g., Monthly Traffic Purchase"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Describe what this template is for..."
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAsTemplate} disabled={createTemplate.isPending}>
                {createTemplate.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Template'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </div>
  );
}
