import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Link2 } from 'lucide-react';

interface PrerequisiteTemplate {
  id: number;
  title: string;
  titleAr?: string | null;
  stakeholderId: number;
  stakeholderName?: string;
  stakeholderNameAr?: string | null;
}

interface PrerequisiteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  prerequisites: PrerequisiteTemplate[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog that shows when selecting a task template with prerequisites.
 * Allows user to confirm adding all prerequisite tasks or cancel.
 */
export function PrerequisiteConfirmDialog({
  open,
  onOpenChange,
  taskName,
  prerequisites,
  onConfirm,
  onCancel,
}: PrerequisiteConfirmDialogProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const getDisplayName = (item: { title: string; titleAr?: string | null }) => {
    return isArabic && item.titleAr ? item.titleAr : item.title;
  };

  const getDeptName = (item: { stakeholderName?: string; stakeholderNameAr?: string | null }) => {
    return isArabic && item.stakeholderNameAr ? item.stakeholderNameAr : item.stakeholderName;
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md" data-testid="prerequisite-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {t('workflows.confirmAddPrerequisites')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-4">
                {t('workflows.confirmAddPrerequisitesDescription', { taskName })}
              </p>
              
              {/* Visual chain display */}
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {t('workflows.prerequisiteChain')}
                </span>
                
                <div className="space-y-2">
                  {prerequisites.map((prereq, index) => (
                    <div key={prereq.id} className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {index + 1}
                      </Badge>
                      <div className="flex-1">
                        <span className="font-medium">{getDisplayName(prereq)}</span>
                        {prereq.stakeholderName && (
                          <span className="text-xs text-muted-foreground ms-2">
                            ({getDeptName(prereq)})
                          </span>
                        )}
                      </div>
                      {index < prerequisites.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                  
                  {/* The selected task (final in chain) */}
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">
                      {prerequisites.length + 1}
                    </Badge>
                    <span className="font-medium text-primary">{taskName}</span>
                    <Badge variant="outline" className="text-xs">
                      {t('workflows.selectPrerequisites').replace('...', '')}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} data-testid="prerequisite-cancel-btn">
            {t('workflows.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} data-testid="prerequisite-confirm-btn">
            {t('workflows.addAllTasks')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
