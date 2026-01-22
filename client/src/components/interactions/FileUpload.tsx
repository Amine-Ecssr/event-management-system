import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  X, 
  FileText, 
  Image, 
  FileSpreadsheet, 
  Presentation, 
  Archive, 
  File,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  INTERACTION_ALLOWED_FILE_TYPES,
  INTERACTION_MAX_FILE_SIZE,
  formatFileSize,
  getFileIconType,
} from './types';

export interface SelectedFile {
  file: File;
  id: string;
  error?: string;
}

interface FileUploadProps {
  selectedFiles: SelectedFile[];
  onFilesChange: (files: SelectedFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  selectedFiles,
  onFilesChange,
  maxFiles = 10,
  disabled = false,
  className,
}: FileUploadProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (mimeType: string) => {
    const iconType = getFileIconType(mimeType);
    const iconClass = 'h-4 w-4';
    switch (iconType) {
      case 'image':
        return <Image className={cn(iconClass, 'text-green-500')} />;
      case 'document':
        return <FileText className={cn(iconClass, 'text-blue-500')} />;
      case 'spreadsheet':
        return <FileSpreadsheet className={cn(iconClass, 'text-emerald-500')} />;
      case 'presentation':
        return <Presentation className={cn(iconClass, 'text-orange-500')} />;
      case 'archive':
        return <Archive className={cn(iconClass, 'text-purple-500')} />;
      default:
        return <File className={cn(iconClass, 'text-gray-500')} />;
    }
  };

  const validateFile = (file: File): string | undefined => {
    // Check file size
    if (file.size > INTERACTION_MAX_FILE_SIZE) {
      return t('interactions.attachments.errors.fileTooLarge', { 
        maxSize: formatFileSize(INTERACTION_MAX_FILE_SIZE) 
      });
    }

    // Check file type by extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!INTERACTION_ALLOWED_FILE_TYPES.includes(ext)) {
      return t('interactions.attachments.errors.invalidFileType');
    }

    return undefined;
  };

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles || disabled) return;

    const filesToAdd: SelectedFile[] = [];
    const currentCount = selectedFiles.length;
    
    for (let i = 0; i < newFiles.length && currentCount + filesToAdd.length < maxFiles; i++) {
      const file = newFiles[i];
      const error = validateFile(file);
      filesToAdd.push({
        file,
        id: `${Date.now()}-${i}-${file.name}`,
        error,
      });
    }

    if (filesToAdd.length > 0) {
      onFilesChange([...selectedFiles, ...filesToAdd]);
    }
  }, [selectedFiles, maxFiles, disabled, onFilesChange, t]);

  const removeFile = useCallback((id: string) => {
    onFilesChange(selectedFiles.filter(f => f.id !== id));
  }, [selectedFiles, onFilesChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled) {
      addFiles(e.dataTransfer.files);
    }
  }, [disabled, addFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addFiles]);

  const openFilePicker = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const remainingSlots = maxFiles - selectedFiles.length;
  const validFiles = selectedFiles.filter(f => !f.error);
  const hasErrors = selectedFiles.some(f => f.error);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer',
          isDragging && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed',
          !isDragging && !disabled && 'border-muted-foreground/25 hover:border-primary/50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={INTERACTION_ALLOWED_FILE_TYPES.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t('interactions.attachments.dropzone')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('interactions.attachments.maxFileSize', { 
            size: formatFileSize(INTERACTION_MAX_FILE_SIZE) 
          })}
        </p>
        {remainingSlots < maxFiles && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('interactions.attachments.filesSelected', { 
              count: validFiles.length,
              max: maxFiles 
            })}
          </p>
        )}
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((selectedFile) => (
            <div
              key={selectedFile.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded-md border',
                selectedFile.error 
                  ? 'border-destructive/50 bg-destructive/5' 
                  : 'border-muted bg-muted/30'
              )}
            >
              {getFileIcon(selectedFile.file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium">
                  {selectedFile.file.name}
                </p>
                {selectedFile.error ? (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {selectedFile.error}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.file.size)}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(selectedFile.id);
                }}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
