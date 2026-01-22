import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateType: 'stakeholder' | 'reminder' | 'management' | 'taskCompletion' | 'updates' | 'invitation';
}

interface PreviewData {
  subject: string;
  html: string;
}

export function EmailPreviewModal({ open, onOpenChange, templateType }: EmailPreviewModalProps) {
  const { data, isLoading, error } = useQuery<PreviewData>({
    queryKey: ['email-preview', templateType],
    queryFn: async () => {
      const response = await fetch(`/api/settings/preview-email/${templateType}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load preview');
      }
      return response.json();
    },
    enabled: open,
  });

  const getTitle = () => {
    switch (templateType) {
      case 'stakeholder':
        return 'Department Email Preview';
      case 'reminder':
        return 'Reminder Email Preview';
      case 'management':
        return 'Management Summary Preview';
      case 'taskCompletion':
        return 'Task Completion Email Preview';
      case 'updates':
        return 'Updates Email Preview';
      case 'invitation':
        return 'Invitation Email Preview';
      default:
        return 'Email Preview';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            This preview shows the exact email that will be sent using your current template and settings.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {error && (
            <div className="text-center py-12 text-destructive">
              Failed to load preview. Please try again.
            </div>
          )}
          
          {data && (
            <div className="space-y-4">
              <div className="border-b pb-3">
                <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                <p className="text-lg font-semibold">{data.subject}</p>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  srcDoc={data.html}
                  className="w-full h-[600px] border-0"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
