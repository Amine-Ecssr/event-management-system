/**
 * PDF Export Service
 * Generates formatted PDF reports with bilingual support
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ExportOptions, ExportResult, ColumnDefinition, STATUS_COLORS, EXPORT_MIME_TYPES } from './types';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color constants
const COLORS = {
  primary: '#2563EB',      // Blue-600
  secondary: '#64748B',    // Slate-500
  headerBg: '#1E40AF',     // Blue-800
  headerText: '#FFFFFF',   // White
  rowEven: '#FFFFFF',      // White
  rowOdd: '#F8FAFC',       // Slate-50
  border: '#E2E8F0',       // Slate-200
  text: '#1E293B',         // Slate-800
  textLight: '#64748B',    // Slate-500
};

export class PDFExportService {
  private readonly ARABIC_FONT_PATH = path.join(__dirname, '../../fonts/NotoSansArabic-Regular.ttf');
  private arabicFontAvailable = false;

  constructor() {
    // Check if Arabic font exists
    this.arabicFontAvailable = fs.existsSync(this.ARABIC_FONT_PATH);
    if (!this.arabicFontAvailable) {
      console.warn('[PDF Export] Arabic font not found at:', this.ARABIC_FONT_PATH);
      console.warn('[PDF Export] Arabic text will use fallback font');
    }
  }

  /**
   * Export data to PDF format
   */
  async exportToPDF<T extends Record<string, unknown>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions,
    title: string
  ): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const isRTL = options.language === 'ar';

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape', // Better for tables
        margin: 40,
        bufferPages: true,
        info: {
          Title: title,
          Author: 'EventCal - ECSSR',
          Creator: 'EventCal Export System',
          CreationDate: new Date(),
        },
      });

      // Register Arabic font if available
      if (this.arabicFontAvailable) {
        try {
          doc.registerFont('Arabic', this.ARABIC_FONT_PATH);
        } catch (e) {
          console.warn('[PDF Export] Failed to register Arabic font:', e);
        }
      }

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const timestamp = new Date().toISOString().split('T')[0];
        const lang = options.language === 'both' ? 'bilingual' : options.language;

        resolve({
          filename: `${title.toLowerCase().replace(/\s+/g, '_')}_report_${timestamp}_${lang}.pdf`,
          mimeType: EXPORT_MIME_TYPES.pdf,
          buffer,
          recordCount: data.length,
        });
      });
      doc.on('error', reject);

      // Build document
      this.addHeader(doc, title, options.language);
      this.addMetadata(doc, data.length, options.language);
      this.addTable(doc, data, columns, options);
      this.addPageNumbers(doc);

      doc.end();
    });
  }

  /**
   * Add document header with title
   */
  private addHeader(doc: PDFKit.PDFDocument, title: string, language: ExportOptions['language']): void {
    const isRTL = language === 'ar';
    
    // Header background
    doc.rect(0, 0, doc.page.width, 70)
       .fill(COLORS.headerBg);

    // Title
    doc.fillColor(COLORS.headerText)
       .font('Helvetica-Bold')
       .fontSize(22);

    const titleText = language === 'ar' && this.arabicFontAvailable
      ? title // Would need Arabic translation
      : title;
    
    doc.text(titleText, 40, 25, {
      width: doc.page.width - 80,
      align: isRTL ? 'right' : 'left',
    });

    // Subtitle - EventCal branding
    doc.fontSize(10)
       .font('Helvetica')
       .text('EventCal - ECSSR Events Calendar', 40, 48, {
         width: doc.page.width - 80,
         align: isRTL ? 'right' : 'left',
       });

    doc.y = 85; // Move cursor below header
  }

  /**
   * Add metadata section (date, record count)
   */
  private addMetadata(doc: PDFKit.PDFDocument, recordCount: number, language: ExportOptions['language']): void {
    const isRTL = language === 'ar';
    
    doc.fillColor(COLORS.textLight)
       .font('Helvetica')
       .fontSize(9);

    const dateLabel = language === 'ar' ? 'تاريخ التصدير' : 'Export Date';
    const recordsLabel = language === 'ar' ? 'عدد السجلات' : 'Total Records';
    
    const exportDate = new Date().toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const metadata = `${dateLabel}: ${exportDate}  |  ${recordsLabel}: ${recordCount}`;
    
    doc.text(metadata, 40, doc.y, {
      width: doc.page.width - 80,
      align: isRTL ? 'right' : 'left',
    });

    doc.moveDown(1.5);
  }

  /**
   * Add data table
   */
  private addTable(
    doc: PDFKit.PDFDocument,
    data: Record<string, unknown>[],
    columns: ColumnDefinition[],
    options: ExportOptions
  ): void {
    const startX = 40;
    const pageWidth = doc.page.width - 80;
    const cellPadding = 5;
    
    // Calculate column widths
    const colWidths = this.calculateColumnWidths(columns, pageWidth);
    
    // Table header
    this.drawTableHeader(doc, columns, colWidths, startX, options.language);
    
    // Table rows
    let y = doc.y;
    const rowHeight = 22;
    
    data.forEach((item, rowIndex) => {
      // Check for page break
      if (y + rowHeight > doc.page.height - 60) {
        doc.addPage();
        this.drawTableHeader(doc, columns, colWidths, startX, options.language);
        y = doc.y;
      }
      
      // Row background
      const bgColor = rowIndex % 2 === 0 ? COLORS.rowEven : COLORS.rowOdd;
      doc.rect(startX, y, pageWidth, rowHeight).fill(bgColor);
      
      // Draw cells
      let x = startX;
      columns.forEach((col, colIndex) => {
        const value = this.formatValue(item[col.key], col.type);
        const cellWidth = colWidths[colIndex];
        
        // Cell text
        doc.fillColor(COLORS.text)
           .font('Helvetica')
           .fontSize(8);
        
        // Apply color for status/priority values
        if (typeof value === 'string' && (col.key.includes('status') || col.key.includes('priority'))) {
          const normalizedValue = value.toLowerCase().replace(/\s+/g, '_');
          const statusColor = STATUS_COLORS[normalizedValue];
          if (statusColor) {
            doc.fillColor(`#${statusColor}`);
          }
        }
        
        doc.text(
          String(value).substring(0, 40), // Truncate long text
          x + cellPadding,
          y + 6,
          {
            width: cellWidth - cellPadding * 2,
            height: rowHeight - 4,
            ellipsis: true,
          }
        );
        
        // Cell border
        doc.strokeColor(COLORS.border)
           .lineWidth(0.5)
           .rect(x, y, cellWidth, rowHeight)
           .stroke();
        
        x += cellWidth;
      });
      
      y += rowHeight;
    });
    
    doc.y = y;
  }

  /**
   * Draw table header row
   */
  private drawTableHeader(
    doc: PDFKit.PDFDocument,
    columns: ColumnDefinition[],
    colWidths: number[],
    startX: number,
    language: ExportOptions['language']
  ): void {
    const headerHeight = language === 'both' ? 30 : 22;
    const pageWidth = doc.page.width - 80;
    const y = doc.y;
    
    // Header background
    doc.rect(startX, y, pageWidth, headerHeight)
       .fill(COLORS.primary);
    
    // Header text
    let x = startX;
    columns.forEach((col, colIndex) => {
      const cellWidth = colWidths[colIndex];
      
      let headerText: string;
      if (language === 'both') {
        headerText = `${col.labelEn}\n${col.labelAr}`;
      } else if (language === 'ar') {
        headerText = col.labelAr;
      } else {
        headerText = col.labelEn;
      }
      
      doc.fillColor(COLORS.headerText)
         .font('Helvetica-Bold')
         .fontSize(8)
         .text(headerText, x + 5, y + (language === 'both' ? 4 : 6), {
           width: cellWidth - 10,
           height: headerHeight - 4,
           align: 'left',
         });
      
      // Header cell border
      doc.strokeColor('#1E3A8A')
         .lineWidth(0.5)
         .rect(x, y, cellWidth, headerHeight)
         .stroke();
      
      x += cellWidth;
    });
    
    doc.y = y + headerHeight;
  }

  /**
   * Calculate optimal column widths
   */
  private calculateColumnWidths(columns: ColumnDefinition[], totalWidth: number): number[] {
    // Use column hints if available, otherwise distribute evenly
    const totalHintedWidth = columns.reduce((sum, col) => sum + (col.width || 15), 0);
    const scale = totalWidth / totalHintedWidth;
    
    return columns.map((col) => Math.floor((col.width || 15) * scale));
  }

  /**
   * Add page numbers to all pages
   */
  private addPageNumbers(doc: PDFKit.PDFDocument): void {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Page number at bottom center
      doc.fillColor(COLORS.textLight)
         .font('Helvetica')
         .fontSize(8)
         .text(
           `Page ${i + 1} of ${pageCount}`,
           0,
           doc.page.height - 30,
           { align: 'center' }
         );
      
      // Footer line
      doc.strokeColor(COLORS.border)
         .lineWidth(0.5)
         .moveTo(40, doc.page.height - 45)
         .lineTo(doc.page.width - 40, doc.page.height - 45)
         .stroke();
    }
  }

  /**
   * Format a value for PDF output
   */
  private formatValue(value: unknown, type?: string): string {
    if (value === null || value === undefined) return '-';

    if (type === 'date') {
      if (value instanceof Date) {
        return value.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }
        return value;
      }
    }

    if (type === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (type === 'array' && Array.isArray(value)) {
      return value.join(', ');
    }

    return String(value);
  }
}

// Singleton instance
export const pdfExportService = new PDFExportService();
