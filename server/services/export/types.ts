/**
 * Export Types
 * Type definitions for the data export system
 */

/** Supported export file formats */
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

/** Supported export languages */
export type ExportLanguage = 'en' | 'ar' | 'both';

/** Export entity types */
export type ExportEntityType = 'events' | 'tasks' | 'contacts' | 'partnerships' | 'organizations' | 'leads';

/** Export options passed to export services */
export interface ExportOptions {
  /** File format for the export */
  format: ExportFormat;
  /** Language for column headers and labels */
  language: ExportLanguage;
  /** Optional filters to apply (passed to storage queries) */
  filters?: Record<string, unknown>;
  /** Optional list of column keys to include (defaults to all) */
  columns?: string[];
  /** Include related data (e.g., attendees with events) */
  includeRelated?: boolean;
  /** Title for the export (used in PDF header) */
  title?: string;
}

/** Result from an export operation */
export interface ExportResult {
  /** Generated filename */
  filename: string;
  /** MIME type of the export file */
  mimeType: string;
  /** File content as buffer (for direct download) */
  buffer?: Buffer;
  /** File content as stream (for large files) */
  stream?: NodeJS.ReadableStream;
  /** MinIO signed URL for large exports */
  url?: string;
  /** Total record count exported */
  recordCount?: number;
}

/** Column definition for export tables */
export interface ColumnDefinition {
  /** Key/field name in the data object */
  key: string;
  /** English label for the column header */
  labelEn: string;
  /** Arabic label for the column header */
  labelAr: string;
  /** Column width (in characters for Excel, points for PDF) */
  width?: number;
  /** Data type for formatting */
  type?: 'string' | 'number' | 'date' | 'boolean' | 'array';
  /** Format string (e.g., 'YYYY-MM-DD' for dates) */
  format?: string;
  /** Alignment in cells */
  align?: 'left' | 'center' | 'right';
}

/** Export job status (for queued/async exports) */
export type ExportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Export job tracking (for large async exports) */
export interface ExportJob {
  /** Unique job identifier */
  id: string;
  /** Entity type being exported */
  type: ExportEntityType;
  /** Current job status */
  status: ExportJobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** When job was created */
  createdAt: Date;
  /** When job completed (success or failure) */
  completedAt?: Date;
  /** Signed download URL (when completed) */
  downloadUrl?: string;
  /** Error message (when failed) */
  error?: string;
  /** Export options used */
  options?: ExportOptions;
}

/** Status color mapping for conditional formatting */
export const STATUS_COLORS: Record<string, string> = {
  // Event status
  upcoming: '5B9BD5',
  ongoing: '70AD47',
  completed: 'A6A6A6',
  cancelled: 'FF0000',
  
  // Task status
  pending: 'FFC000',
  in_progress: '5B9BD5',
  completed_task: '70AD47',
  overdue: 'FF0000',
  
  // Priority
  high: 'FF0000',
  medium: 'FFC000',
  low: '70AD47',
  
  // Partnership status
  active: '70AD47',
  inactive: 'A6A6A6',
  expired: 'FF0000',
};

/** MIME types for export formats */
export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
};

/** File extensions for export formats */
export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  xlsx: '.xlsx',
  csv: '.csv',
  pdf: '.pdf',
};
