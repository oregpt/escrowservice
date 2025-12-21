import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, FileIcon, Loader2, DollarSign, CheckCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmationStep = 'FUNDING' | 'PARTY_B_CONFIRM' | 'PARTY_A_CONFIRM';

interface ConfirmationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: ConfirmationStep;
  escrowId: string;
  amount?: number;
  currency?: string;
  onSubmit: (data: {
    notes: string;
    file?: File;
    holdUntilCompletion: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

const STEP_CONFIG: Record<ConfirmationStep, {
  title: string;
  description: string;
  submitLabel: string;
  icon: React.ReactNode;
  color: string;
}> = {
  FUNDING: {
    title: "Fund Deal",
    description: "Transfer funds into escrow to activate this deal. Add any notes or attachments for the counterparty.",
    submitLabel: "Fund Deal",
    icon: <DollarSign className="h-5 w-5" />,
    color: "bg-amber-600 hover:bg-amber-700",
  },
  PARTY_B_CONFIRM: {
    title: "Confirm Delivery",
    description: "Confirm you have delivered the required service or item. Attach proof if applicable.",
    submitLabel: "Confirm Delivery",
    icon: <CheckCircle className="h-5 w-5" />,
    color: "bg-blue-600 hover:bg-blue-700",
  },
  PARTY_A_CONFIRM: {
    title: "Confirm Receipt",
    description: "Confirm you have received the deliverable. This will release funds to the counterparty.",
    submitLabel: "Confirm & Release Funds",
    icon: <CheckCircle className="h-5 w-5" />,
    color: "bg-emerald-600 hover:bg-emerald-700",
  },
};

export function ConfirmationFormModal({
  open,
  onOpenChange,
  step,
  escrowId,
  amount,
  currency,
  onSubmit,
  isSubmitting = false,
}: ConfirmationFormModalProps) {
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [holdUntilCompletion, setHoldUntilCompletion] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const config = STEP_CONFIG[step];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    await onSubmit({
      notes: notes.trim(),
      file: selectedFile || undefined,
      holdUntilCompletion,
    });
    // Reset form on success
    setNotes("");
    setSelectedFile(null);
    setHoldUntilCompletion(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setNotes("");
      setSelectedFile(null);
      setHoldUntilCompletion(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount display for funding */}
          {step === 'FUNDING' && amount !== undefined && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-700 mb-1">Amount to Fund</p>
              <p className="text-2xl font-bold text-amber-900">
                ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
              </p>
            </div>
          )}

          {/* Notes textarea */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes or information for the other party..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <Label>Attachment (optional)</Label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isSubmitting && fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 hover:border-primary/50 hover:bg-slate-50/50",
                selectedFile && "border-emerald-300 bg-emerald-50/50",
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="*/*"
                disabled={isSubmitting}
              />

              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-emerald-100 flex items-center justify-center">
                      <FileIcon className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Upload className="h-6 w-6 text-slate-400" />
                  <p className="text-sm text-muted-foreground">
                    Drop file here or click to browse
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Hold until completion checkbox */}
          {selectedFile && (
            <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg border">
              <Checkbox
                id="holdUntilCompletion"
                checked={holdUntilCompletion}
                onCheckedChange={(checked) => setHoldUntilCompletion(checked === true)}
                disabled={isSubmitting}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="holdUntilCompletion"
                  className="text-sm font-medium cursor-pointer flex items-center gap-1"
                >
                  <Lock className="h-3 w-3" />
                  Hold in escrow until both parties confirm
                </Label>
                <p className="text-xs text-muted-foreground">
                  The other party won't be able to download this file until the deal is completed
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            className={config.color}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {config.icon}
                <span className="ml-2">{config.submitLabel}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
