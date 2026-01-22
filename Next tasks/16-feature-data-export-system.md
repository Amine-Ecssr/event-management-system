# Feature: Data Export System

## Type
Feature / Reporting

## Priority
🟡 Medium

## Estimated Effort
6-8 hours

## Description
Comprehensive data export system supporting Excel, CSV, and PDF formats with bilingual support (English/Arabic/Both). Integrates with Elasticsearch for filtered exports and MinIO for temporary file storage.

## Architecture Context
- **Storage**: MinIO at `storage.eventcal.app` for export file hosting
- **Search**: Uses Elasticsearch (`ES_INDEX_PREFIX`: eventcal) for filtered exports
- **i18n**: All headers/labels from translation files

## Requirements

### Export Formats
1. **Excel (.xlsx)**
   - Multiple sheets for related data
   - Formatted headers with translations
   - Auto-width columns
   - Arabic RTL support
   - Conditional formatting for status fields

2. **CSV (.csv)**
   - UTF-8 encoding with BOM for Arabic
   - Excel-compatible
   - Configurable delimiter

3. **PDF**
   - Formatted reports with branding
   - Arabic font support (Noto Sans Arabic)
   - Header/footer with metadata
   - Charts rendered as images

### Export Types

#### Events Export
- Event list with all fields
- Event with attendees
- Event with tasks
- Event summary report

#### Tasks Export
- Task list by status
- Task list by department
- Overdue tasks report
- Task completion report

#### Contacts Export
- Contact database
- Speaker list
- Contacts by organization
- Engagement report

#### Partnerships Export
- Partnership list
- Agreement list
- Activity report
- Partner contacts

#### Analytics Export
- Dashboard data export
- Custom date range
- Chart data as tables

### Language Options
- English only (`en`)
- Arabic only (`ar`)
- Bilingual (`both`) - side-by-side columns

---

## Complete Implementation

### Export Service Types (`server/services/export/types.ts`)
```typescript
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';
export type ExportLanguage = 'en' | 'ar' | 'both';

export interface ExportOptions {
  format: ExportFormat;
  language: ExportLanguage;
  filters?: Record<string, any>;
  columns?: string[];
  includeRelated?: boolean;
}

export interface ExportResult {
  filename: string;
  mimeType: string;
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  url?: string;  // MinIO signed URL for large exports
}

export interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelAr: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
}

export interface ExportJob {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  error?: string;
}
```

### Excel Export Service (`server/services/export/excel-export.service.ts`)
```typescript
import ExcelJS from 'exceljs';
import { ExportOptions, ExportResult, ColumnDefinition } from './types';

export class ExcelExportService {
  async exportToExcel<T extends Record<string, any>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions,
    sheetName = 'Data'
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EventCal';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: options.language === 'ar' }],
    });
    
    // Configure columns based on language
    worksheet.columns = this.buildColumns(columns, options.language);
    
    // Add header row with styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Add data rows
    data.forEach(item => {
      const rowData = columns.map(col => this.formatValue(item[col.key], col.type));
      worksheet.addRow(rowData);
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, cell => {
        const length = cell.value?.toString().length || 0;
        if (length > maxLength) maxLength = Math.min(length, 50);
      });
      column.width = maxLength + 2;
    });
    
    // Add filters
    worksheet.autoFilter = {
      from: 'A1',
      to: { row: 1, column: columns.length },
    };
    
    const buffer = await workbook.xlsx.writeBuffer();
    
    return {
      filename: `export_${Date.now()}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(buffer),
    };
  }
  
  private buildColumns(columns: ColumnDefinition[], language: ExportOptions['language']) {
    return columns.map(col => {
      let header: string;
      if (language === 'both') {
        header = `${col.labelEn} / ${col.labelAr}`;
      } else if (language === 'ar') {
        header = col.labelAr;
      } else {
        header = col.labelEn;
      }
      return { header, key: col.key, width: col.width || 15 };
    });
  }
  
  private formatValue(value: any, type?: string): any {
    if (value === null || value === undefined) return '';
    if (type === 'date' && value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return value;
  }
}

export const excelExportService = new ExcelExportService();
```

### CSV Export Service (`server/services/export/csv-export.service.ts`)
```typescript
import { stringify } from 'csv-stringify/sync';
import { ExportOptions, ExportResult, ColumnDefinition } from './types';

export class CSVExportService {
  async exportToCSV<T extends Record<string, any>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions
  ): Promise<ExportResult> {
    // Build headers based on language
    const headers = columns.map(col => {
      if (options.language === 'both') return `${col.labelEn} / ${col.labelAr}`;
      if (options.language === 'ar') return col.labelAr;
      return col.labelEn;
    });
    
    // Transform data to array format
    const rows = data.map(item => 
      columns.map(col => this.formatValue(item[col.key], col.type))
    );
    
    // Generate CSV with BOM for Excel Arabic support
    const csvContent = stringify([headers, ...rows], {
      bom: true,  // UTF-8 BOM for Excel
      delimiter: ',',
    });
    
    return {
      filename: `export_${Date.now()}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      buffer: Buffer.from(csvContent, 'utf-8'),
    };
  }
  
  private formatValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '';
    if (type === 'date' && value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.join('; ');
    }
    return String(value);
  }
}

export const csvExportService = new CSVExportService();
```

### PDF Export Service (`server/services/export/pdf-export.service.ts`)
```typescript
import PDFDocument from 'pdfkit';
import { ExportOptions, ExportResult, ColumnDefinition } from './types';
import path from 'path';

export class PDFExportService {
  private readonly ARABIC_FONT = path.join(__dirname, '../../fonts/NotoSansArabic-Regular.ttf');
  private readonly LOGO_PATH = path.join(__dirname, '../../assets/logo.png');
  
  async exportToPDF<T extends Record<string, any>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions,
    title: string
  ): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50,
        info: {
          Title: title,
          Author: 'EventCal',
          Creator: 'EventCal Export System',
        },
      });
      
      // Register Arabic font
      try {
        doc.registerFont('Arabic', this.ARABIC_FONT);
      } catch (e) {
        console.warn('Arabic font not found, falling back to default');
      }
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        resolve({
          filename: `export_${Date.now()}.pdf`,
          mimeType: 'application/pdf',
          buffer: Buffer.concat(chunks),
        });
      });
      doc.on('error', reject);
      
      // Header
      this.addHeader(doc, title, options.language);
      
      // Table
      this.addTable(doc, data, columns, options);
      
      // Footer
      this.addFooter(doc);
      
      doc.end();
    });
  }
  
  private addHeader(doc: PDFKit.PDFDocument, title: string, language: string) {
    doc.fontSize(18).font('Helvetica-Bold');
    
    const titleText = language === 'ar' ? `تقرير: ${title}` : `Report: ${title}`;
    doc.text(titleText, { align: language === 'ar' ? 'right' : 'left' });
    
    doc.moveDown();
    doc.fontSize(10).font('Helvetica');
    doc.text(`Generated: ${new Date().toISOString().split('T')[0]}`, { align: 'left' });
    doc.moveDown(2);
  }
  
  private addTable(
    doc: PDFKit.PDFDocument, 
    data: any[], 
    columns: ColumnDefinition[], 
    options: ExportOptions
  ) {
    const tableTop = doc.y;
    const cellPadding = 5;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    
    // Headers
    doc.font('Helvetica-Bold').fontSize(9);
    columns.forEach((col, i) => {
      const label = options.language === 'ar' ? col.labelAr : col.labelEn;
      doc.text(label, doc.page.margins.left + (i * colWidth), tableTop, {
        width: colWidth - cellPadding,
        align: 'left',
      });
    });
    
    // Draw header line
    const headerBottom = doc.y + 5;
    doc.moveTo(doc.page.margins.left, headerBottom)
       .lineTo(doc.page.width - doc.page.margins.right, headerBottom)
       .stroke();
    
    // Data rows
    doc.font('Helvetica').fontSize(8);
    let y = headerBottom + 10;
    
    data.forEach((item, rowIndex) => {
      // Check for page break
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      
      columns.forEach((col, colIndex) => {
        const value = this.formatValue(item[col.key], col.type);
        doc.text(String(value).substring(0, 30), doc.page.margins.left + (colIndex * colWidth), y, {
          width: colWidth - cellPadding,
          height: 15,
          ellipsis: true,
        });
      });
      
      y += 20;
    });
  }
  
  private addFooter(doc: PDFKit.PDFDocument) {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(
        `Page ${i + 1} of ${pageCount}`,
        0,
        doc.page.height - 30,
        { align: 'center' }
      );
    }
  }
  
  private formatValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '-';
    if (type === 'date' && value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return String(value);
  }
}

export const pdfExportService = new PDFExportService();
```

### Main Export Service (`server/services/export/export.service.ts`)
```typescript
import { storage } from '../../repositories';
import { excelExportService } from './excel-export.service';
import { csvExportService } from './csv-export.service';
import { pdfExportService } from './pdf-export.service';
import { ExportOptions, ExportResult, ColumnDefinition, ExportJob } from './types';
import { minioClient, uploadBuffer, getSignedUrl } from '../minio.service';

// Column definitions for each entity
const EVENT_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number' },
  { key: 'title', labelEn: 'Title', labelAr: 'العنوان', width: 30 },
  { key: 'titleAr', labelEn: 'Title (Arabic)', labelAr: 'العنوان بالعربية', width: 30 },
  { key: 'startDate', labelEn: 'Start Date', labelAr: 'تاريخ البداية', type: 'date' },
  { key: 'endDate', labelEn: 'End Date', labelAr: 'تاريخ النهاية', type: 'date' },
  { key: 'category', labelEn: 'Category', labelAr: 'الفئة' },
  { key: 'eventType', labelEn: 'Type', labelAr: 'النوع' },
  { key: 'location', labelEn: 'Location', labelAr: 'الموقع' },
  { key: 'isArchived', labelEn: 'Archived', labelAr: 'مؤرشف', type: 'boolean' },
];

const TASK_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number' },
  { key: 'title', labelEn: 'Title', labelAr: 'العنوان', width: 30 },
  { key: 'status', labelEn: 'Status', labelAr: 'الحالة' },
  { key: 'priority', labelEn: 'Priority', labelAr: 'الأولوية' },
  { key: 'dueDate', labelEn: 'Due Date', labelAr: 'تاريخ الاستحقاق', type: 'date' },
  { key: 'assigneeName', labelEn: 'Assignee', labelAr: 'المسؤول' },
  { key: 'eventTitle', labelEn: 'Event', labelAr: 'الفعالية' },
];

const CONTACT_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number' },
  { key: 'name', labelEn: 'Name', labelAr: 'الاسم', width: 25 },
  { key: 'nameAr', labelEn: 'Name (Arabic)', labelAr: 'الاسم بالعربية', width: 25 },
  { key: 'email', labelEn: 'Email', labelAr: 'البريد الإلكتروني', width: 30 },
  { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف' },
  { key: 'organizationName', labelEn: 'Organization', labelAr: 'المنظمة' },
  { key: 'jobTitle', labelEn: 'Job Title', labelAr: 'المسمى الوظيفي' },
];

const PARTNERSHIP_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number' },
  { key: 'organizationName', labelEn: 'Organization', labelAr: 'المنظمة', width: 30 },
  { key: 'agreementType', labelEn: 'Type', labelAr: 'النوع' },
  { key: 'startDate', labelEn: 'Start Date', labelAr: 'تاريخ البداية', type: 'date' },
  { key: 'endDate', labelEn: 'End Date', labelAr: 'تاريخ النهاية', type: 'date' },
  { key: 'status', labelEn: 'Status', labelAr: 'الحالة' },
];

// In-memory job tracking (use Redis in production)
const exportJobs = new Map<string, ExportJob>();

export class ExportService {
  async exportEvents(options: ExportOptions): Promise<ExportResult> {
    const events = await storage.getEvents(options.filters);
    return this.export(events, EVENT_COLUMNS, options, 'Events');
  }
  
  async exportTasks(options: ExportOptions): Promise<ExportResult> {
    const tasks = await storage.getTasks(options.filters);
    return this.export(tasks, TASK_COLUMNS, options, 'Tasks');
  }
  
  async exportContacts(options: ExportOptions): Promise<ExportResult> {
    const contacts = await storage.getContacts();
    return this.export(contacts, CONTACT_COLUMNS, options, 'Contacts');
  }
  
  async exportPartnerships(options: ExportOptions): Promise<ExportResult> {
    const partnerships = await storage.getPartnerships();
    return this.export(partnerships, PARTNERSHIP_COLUMNS, options, 'Partnerships');
  }
  
  private async export<T extends Record<string, any>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions,
    title: string
  ): Promise<ExportResult> {
    // Filter columns if specified
    const filteredColumns = options.columns
      ? columns.filter(c => options.columns!.includes(c.key))
      : columns;
    
    switch (options.format) {
      case 'xlsx':
        return excelExportService.exportToExcel(data, filteredColumns, options, title);
      case 'csv':
        return csvExportService.exportToCSV(data, filteredColumns, options);
      case 'pdf':
        return pdfExportService.exportToPDF(data, filteredColumns, options, title);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }
  
  // For large exports, queue job and upload to MinIO
  async queueLargeExport(
    type: 'events' | 'tasks' | 'contacts' | 'partnerships',
    options: ExportOptions
  ): Promise<string> {
    const jobId = `export-${type}-${Date.now()}`;
    
    exportJobs.set(jobId, {
      id: jobId,
      type,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    });
    
    // Process async
    this.processExportJob(jobId, type, options);
    
    return jobId;
  }
  
  private async processExportJob(
    jobId: string,
    type: string,
    options: ExportOptions
  ) {
    const job = exportJobs.get(jobId);
    if (!job) return;
    
    try {
      job.status = 'processing';
      
      let result: ExportResult;
      switch (type) {
        case 'events':
          result = await this.exportEvents(options);
          break;
        case 'tasks':
          result = await this.exportTasks(options);
          break;
        case 'contacts':
          result = await this.exportContacts(options);
          break;
        case 'partnerships':
          result = await this.exportPartnerships(options);
          break;
        default:
          throw new Error(`Unknown export type: ${type}`);
      }
      
      // Upload to MinIO
      const objectKey = `exports/${jobId}/${result.filename}`;
      await uploadBuffer(result.buffer!, 'eventcal-exports', objectKey, result.mimeType);
      
      // Get signed URL (expires in 24 hours)
      const url = await getSignedUrl('eventcal-exports', objectKey, 86400);
      
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.downloadUrl = url;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }
  
  getJobStatus(jobId: string): ExportJob | undefined {
    return exportJobs.get(jobId);
  }
}

export const exportService = new ExportService();
```

### Export Routes (`server/routes/export.routes.ts`)
```typescript
import { Router } from 'express';
import { exportService } from '../services/export/export.service';
import { isAuthenticated } from '../auth';
import { z } from 'zod';

const router = Router();

const exportQuerySchema = z.object({
  format: z.enum(['xlsx', 'csv', 'pdf']).default('xlsx'),
  language: z.enum(['en', 'ar', 'both']).default('en'),
  columns: z.string().optional().transform(v => v?.split(',')),
});

// Events export
router.get('/api/export/events', isAuthenticated, async (req, res) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportEvents({
      format: options.format,
      language: options.language,
      columns: options.columns,
      filters: req.query,
    });
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Tasks export
router.get('/api/export/tasks', isAuthenticated, async (req, res) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportTasks({
      format: options.format,
      language: options.language,
      columns: options.columns,
      filters: req.query,
    });
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Contacts export
router.get('/api/export/contacts', isAuthenticated, async (req, res) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportContacts({
      format: options.format,
      language: options.language,
      columns: options.columns,
    });
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Partnerships export
router.get('/api/export/partnerships', isAuthenticated, async (req, res) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportPartnerships({
      format: options.format,
      language: options.language,
      columns: options.columns,
    });
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Large export with job queue
router.post('/api/export/queue', isAuthenticated, async (req, res) => {
  try {
    const { type, ...options } = req.body;
    const jobId = await exportService.queueLargeExport(type, options);
    res.json({ jobId, status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to queue export' });
  }
});

// Check job status
router.get('/api/export/job/:jobId', isAuthenticated, async (req, res) => {
  const job = exportService.getJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

export default router;
```

### Frontend Export Button (`client/src/components/ExportButton.tsx`)
```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, FileText, File, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  entityType: 'events' | 'tasks' | 'contacts' | 'partnerships';
  filters?: Record<string, any>;
}

type ExportFormat = 'xlsx' | 'csv' | 'pdf';
type ExportLanguage = 'en' | 'ar' | 'both';

export function ExportButton({ entityType, filters }: ExportButtonProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = async (format: ExportFormat, language: ExportLanguage) => {
    setIsExporting(true);
    
    try {
      const params = new URLSearchParams({
        format,
        language,
        ...filters,
      });
      
      const response = await fetch(`/api/export/${entityType}?${params}`);
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || `${entityType}_export.${format}`;
      
      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t('export.success'),
        description: t('export.downloadStarted'),
      });
    } catch (error) {
      toast({
        title: t('export.error'),
        description: t('export.errorMessage'),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  const formatIcon = {
    xlsx: <FileSpreadsheet className="h-4 w-4 mr-2" />,
    csv: <FileText className="h-4 w-4 mr-2" />,
    pdf: <File className="h-4 w-4 mr-2" />,
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {t('common.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('export.format')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map(format => (
          <DropdownMenuSub key={format}>
            <DropdownMenuSubTrigger>
              {formatIcon[format]}
              {format.toUpperCase()}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel>{t('export.language')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport(format, 'en')}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(format, 'ar')}>
                العربية
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(format, 'both')}>
                {t('export.bilingual')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### Files to Create
- `server/services/export/types.ts` - Export type definitions
- `server/services/export/export.service.ts` - Main export orchestrator
- `server/services/export/excel-export.service.ts` - Excel generation
- `server/services/export/csv-export.service.ts` - CSV generation
- `server/services/export/pdf-export.service.ts` - PDF generation
- `server/routes/export.routes.ts` - Export API routes
- `server/fonts/NotoSansArabic-Regular.ttf` - Arabic font for PDF
- `client/src/components/ExportButton.tsx` - Frontend export UI
- `client/src/i18n/locales/en/export.json` - English translations
- `client/src/i18n/locales/ar/export.json` - Arabic translations

### Files to Modify
- `server/routes.ts` - Mount export routes
- `package.json` - Add dependencies

### NPM Packages
```bash
npm install exceljs csv-stringify pdfkit
npm install -D @types/pdfkit
```

## Acceptance Criteria
- [ ] Excel export works with Arabic (RTL layout)
- [ ] CSV exports UTF-8 encoded with BOM
- [ ] PDF renders Arabic correctly with Noto Sans Arabic
- [ ] Language options (en/ar/both) work for all formats
- [ ] Large datasets handled via job queue + MinIO
- [ ] Progress indicator for large exports
- [ ] Export button integrated in Events, Tasks, Contacts, Partnerships pages
- [ ] i18n translations for export UI

## Dependencies
- Task 07: Search Service (for filtered exports)
- MinIO configured at storage.eventcal.app
