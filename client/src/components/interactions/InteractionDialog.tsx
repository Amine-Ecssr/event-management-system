import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import {
  type BaseInteraction,
  type EntityType,
  type InteractionAttachment,
  getInteractionTypes,
  getTranslationPrefix,
} from './types';
import { FileUpload, type SelectedFile } from './FileUpload';
import { AttachmentList } from './AttachmentList';

interface InteractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: number;
  interaction?: BaseInteraction | null;
}

export function InteractionDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  interaction,
}: InteractionDialogProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar';
  const isEditing = !!interaction;
  const translationPrefix = getTranslationPrefix(entityType);
  const interactionTypes = getInteractionTypes(entityType);

  // Form state
  const [type, setType] = useState<string>('meeting');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [outcome, setOutcome] = useState('');
  const [outcomeAr, setOutcomeAr] = useState('');
  const [interactionDate, setInteractionDate] = useState('');
  
  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null);

  // Helper to format date for datetime-local input (local time)
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Reset form when dialog opens/closes or interaction changes
  useEffect(() => {
    if (open && interaction) {
      setType(interaction.type || 'meeting');
      setDescription(interaction.description || '');
      setDescriptionAr(interaction.descriptionAr || '');
      setOutcome(interaction.outcome || '');
      setOutcomeAr(interaction.outcomeAr || '');
      setSelectedFiles([]);
      // Format date for input (local time)
      if (interaction.interactionDate) {
        const date = new Date(interaction.interactionDate);
        setInteractionDate(formatDateForInput(date));
      } else {
        setInteractionDate(formatDateForInput(new Date()));
      }
    } else if (open) {
      // Reset for new interaction
      setType('meeting');
      setDescription('');
      setDescriptionAr('');
      setOutcome('');
      setOutcomeAr('');
      setSelectedFiles([]);
      setInteractionDate(formatDateForInput(new Date()));
    }
  }, [open, interaction]);

  // Fetch existing attachments when editing
  const attachmentsQueryKey = isEditing && interaction
    ? entityType === 'lead'
      ? [`/api/leads/${entityId}/interactions/${interaction.id}/attachments`]
      : [`/api/partnerships/${entityId}/interactions/${interaction.id}/attachments`]
    : null;

  const { data: existingAttachments = [], isLoading: attachmentsLoading } = useQuery<InteractionAttachment[]>({
    queryKey: attachmentsQueryKey || ['disabled'],
    queryFn: () => apiRequest('GET', attachmentsQueryKey![0]),
    enabled: !!attachmentsQueryKey && isEditing,
  });

  // API path based on entity type
  const getApiPath = () => {
    if (entityType === 'lead') {
      return isEditing
        ? `/api/lead-interactions/${interaction?.id}`
        : `/api/leads/${entityId}/interactions`;
    }
    return isEditing
      ? `/api/partnership-interactions/${interaction?.id}`
      : `/api/partnerships/${entityId}/interactions`;
  };

  // Query key for cache invalidation
  const getQueryKey = () => {
    return entityType === 'lead'
      ? [`/api/leads/${entityId}/interactions`]
      : [`/api/partnerships/${entityId}/interactions`];
  };

  // Get attachment upload path
  const getAttachmentUploadPath = (interactionId: number) => {
    return entityType === 'lead'
      ? `/api/leads/${entityId}/interactions/${interactionId}/attachments`
      : `/api/partnerships/${entityId}/interactions/${interactionId}/attachments`;
  };

  // Upload files for an interaction
  const uploadFiles = async (interactionId: number) => {
    const validFiles = selectedFiles.filter(f => !f.error);
    if (validFiles.length === 0) return;

    setIsUploadingFiles(true);
    const uploadPath = getAttachmentUploadPath(interactionId);
    
    for (const selectedFile of validFiles) {
      const formData = new FormData();
      formData.append('file', selectedFile.file);
      
      try {
        await fetch(uploadPath, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
      } catch (error) {
        console.error('Failed to upload file:', selectedFile.file.name, error);
      }
    }
    
    setIsUploadingFiles(false);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', getApiPath(), data);
    },
    onSuccess: async (newInteraction: any) => {
      // Upload files if any
      if (selectedFiles.filter(f => !f.error).length > 0 && newInteraction?.id) {
        await uploadFiles(newInteraction.id);
        // Invalidate attachments query
        queryClient.invalidateQueries({ 
          queryKey: [getAttachmentUploadPath(newInteraction.id)] 
        });
      }
      
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
      toast({ description: t(`${translationPrefix}.messages.interactionAdded`) });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        description: error.message || t('common.error'),
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PUT', getApiPath(), data);
    },
    onSuccess: async () => {
      // Upload new files if any
      if (selectedFiles.filter(f => !f.error).length > 0 && interaction?.id) {
        await uploadFiles(interaction.id);
        // Invalidate attachments query
        if (attachmentsQueryKey) {
          queryClient.invalidateQueries({ queryKey: attachmentsQueryKey });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: getQueryKey() });
      toast({ description: t(`${translationPrefix}.messages.interactionUpdated`) });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        description: error.message || t('common.error'),
        variant: 'destructive',
      });
    },
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      return apiRequest('DELETE', `/api/interactions/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      if (attachmentsQueryKey) {
        queryClient.invalidateQueries({ queryKey: attachmentsQueryKey });
      }
      toast({ description: t(`${translationPrefix}.interactions.attachments.deleted`) });
    },
    onError: (error: any) => {
      toast({
        description: error.message || t('common.error'),
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setDeletingAttachmentId(null);
    },
  });

  const handleDeleteAttachment = (attachmentId: number) => {
    setDeletingAttachmentId(attachmentId);
    deleteAttachmentMutation.mutate(attachmentId);
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast({
        description: t('common.required'),
        variant: 'destructive',
      });
      return;
    }

    const data = {
      type,
      description: description.trim(),
      descriptionAr: descriptionAr.trim() || null,
      outcome: outcome.trim() || null,
      outcomeAr: outcomeAr.trim() || null,
      interactionDate: interactionDate ? new Date(interactionDate) : new Date(),
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || isUploadingFiles;
  const validFilesCount = selectedFiles.filter(f => !f.error).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t(`${translationPrefix}.interactions.editInteraction`)
              : t(`${translationPrefix}.interactions.addInteraction`)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Interaction Type */}
          <div className="space-y-2">
            <Label>{t(`${translationPrefix}.interactions.interactionType`)}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {interactionTypes.map((interactionType) => (
                  <SelectItem key={interactionType} value={interactionType}>
                    {t(`${translationPrefix}.interactions.types.${interactionType}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date/Time */}
          <div className="space-y-2">
            <Label>{t(`${translationPrefix}.interactions.createdAt`)}</Label>
            <Input
              type="datetime-local"
              value={interactionDate}
              onChange={(e) => setInteractionDate(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>
              {t(`${translationPrefix}.interactions.description`)} *
            </Label>
            <Textarea
              placeholder={t(`${translationPrefix}.interactions.description`)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Arabic Description */}
          <div className="space-y-2">
            <Label>
              {t(`${translationPrefix}.interactions.description`)} ({t('common.arabic')})
            </Label>
            <Textarea
              dir="rtl"
              placeholder={t(`${translationPrefix}.interactions.description`)}
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              rows={3}
            />
          </div>

          {/* Outcome */}
          <div className="space-y-2">
            <Label>{t(`${translationPrefix}.interactions.outcome`)}</Label>
            <Textarea
              placeholder={t(`${translationPrefix}.interactions.outcome`)}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={3}
            />
          </div>

          {/* Arabic Outcome */}
          <div className="space-y-2">
            <Label>
              {t(`${translationPrefix}.interactions.outcome`)} ({t('common.arabic')})
            </Label>
            <Textarea
              dir="rtl"
              placeholder={t(`${translationPrefix}.interactions.outcome`)}
              value={outcomeAr}
              onChange={(e) => setOutcomeAr(e.target.value)}
              rows={2}
            />
          </div>

          <Separator />

          {/* Attachments Section */}
          <div className="space-y-3">
            <Label>{t(`${translationPrefix}.interactions.attachments.label`)}</Label>
            
            {/* Existing attachments (when editing) */}
            {isEditing && !attachmentsLoading && existingAttachments.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2">
                  {t(`${translationPrefix}.interactions.attachments.existing`)}
                </p>
                <AttachmentList
                  attachments={existingAttachments}
                  onDelete={handleDeleteAttachment}
                  isDeleting={deletingAttachmentId}
                  showDelete={true}
                />
              </div>
            )}
            
            {attachmentsLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            )}

            {/* File upload */}
            <FileUpload
              selectedFiles={selectedFiles}
              onFilesChange={setSelectedFiles}
              maxFiles={10}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isUploadingFiles 
                  ? t(`${translationPrefix}.interactions.attachments.uploading`)
                  : t('common.saving')
                }
              </>
            ) : isEditing ? (
              t('common.save')
            ) : (
              <>
                {t('common.add')}
                {validFilesCount > 0 && ` (${validFilesCount} ${t(`${translationPrefix}.interactions.attachments.files`)})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
