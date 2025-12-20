import { FileIcon, ImageIcon, FileText, Download, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'archive' | 'code';
  size: string;
  uploadedBy: string;
  date: string;
  status: 'locked' | 'released';
}

interface AttachmentListProps {
  attachments: Attachment[];
}

const TYPE_ICONS = {
  pdf: FileText,
  image: ImageIcon,
  archive: FileIcon, // generic
  code: FileIcon // generic
};

export function AttachmentList({ attachments }: AttachmentListProps) {
  return (
    <div className="space-y-3">
      {attachments.map((file) => {
        const Icon = TYPE_ICONS[file.type] || FileIcon;
        const isLocked = file.status === 'locked';

        return (
          <div 
            key={file.id} 
            className="group flex items-center justify-between p-3 rounded-lg border bg-white hover:border-primary/20 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center",
                isLocked ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-600"
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {file.name}
                  {isLocked ? (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 bg-slate-50 text-slate-500">
                      <Lock className="w-3 h-3" /> Encrypted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 bg-emerald-50 text-emerald-600 border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> Released
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {file.size} • Uploaded by {file.uploadedBy} • {file.date}
                </div>
              </div>
            </div>

            <Button 
              size="sm" 
              variant={isLocked ? "ghost" : "outline"}
              disabled={isLocked}
              className={cn(isLocked && "opacity-50")}
            >
              {isLocked ? <Lock className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
