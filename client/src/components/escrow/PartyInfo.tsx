import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PartyInfoProps {
  role: 'Originator' | 'Counterparty' | 'Mediator';
  name: string;
  email?: string;
  isCurrentUser?: boolean;
  status?: 'waiting' | 'ready' | 'action_required' | 'confirmed';
  className?: string;
}

export function PartyInfo({ role, name, email, isCurrentUser, status, className }: PartyInfoProps) {
  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-xl border bg-card/50", className)}>
      <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
        <AvatarImage src={`/avatars/${role.toLowerCase()}.png`} />
        <AvatarFallback className="bg-slate-100 text-slate-600 font-bold">
          {name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{role}</span>
          {isCurrentUser && <Badge variant="secondary" className="text-[10px] px-1.5 h-4">YOU</Badge>}
        </div>
        <div className="font-semibold text-base">{name}</div>
        {email && <div className="text-sm text-muted-foreground">{email}</div>}
      </div>

      {status === 'action_required' && (
        <Badge variant="destructive" className="animate-pulse">Action Required</Badge>
      )}
      {status === 'ready' && (
        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Ready</Badge>
      )}
      {status === 'confirmed' && (
        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Confirmed</Badge>
      )}
    </div>
  );
}
