import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";
import type { EscrowStatus } from "@/lib/types";

interface EscrowTimelineProps {
  status: EscrowStatus;
  createdAt: string;
}

const STEPS = [
  { id: 'CREATED', label: 'Created' },
  { id: 'PENDING_ACCEPTANCE', label: 'Accepted' },
  { id: 'FUNDED', label: 'Funded' },
  { id: 'PARTY_B_CONFIRMED', label: 'Delivered' },
  { id: 'PARTY_A_CONFIRMED', label: 'Confirmed' },
  { id: 'COMPLETED', label: 'Complete' },
];

export function EscrowTimeline({ status, createdAt }: EscrowTimelineProps) {
  // Simple logic to determine current step index
  // In a real app, this mapping would be more robust
  const getStepIndex = (s: EscrowStatus) => {
    switch(s) {
      case 'CREATED': return 0;
      case 'PENDING_ACCEPTANCE': return 1;
      case 'PENDING_FUNDING': return 1; // Between accepted and funded
      case 'FUNDED': return 2;
      case 'PARTY_B_CONFIRMED': return 3;
      case 'PARTY_A_CONFIRMED': return 4;
      case 'COMPLETED': return 5;
      default: return 0;
    }
  };

  const currentIndex = getStepIndex(status);

  return (
    <div className="relative">
      {/* Mobile Vertical View could go here, for now desktop horizontal */}
      <div className="flex items-center justify-between w-full">
        <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-100 -z-10" />
        
        {STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 bg-white",
                  isCompleted ? "border-emerald-500 text-emerald-500" : "border-slate-200 text-slate-300",
                  isCurrent && "ring-4 ring-emerald-500/20"
                )}
              >
                {index < currentIndex ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : isCurrent ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                ) : (
                  <Circle className="w-4 h-4 fill-transparent" />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium transition-colors",
                isCompleted ? "text-foreground" : "text-muted-foreground",
                isCurrent && "text-emerald-600 font-bold"
              )}>
                {step.label}
              </span>
              {index === 0 && (
                <span className="text-[10px] text-muted-foreground absolute top-14">
                  {createdAt}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
