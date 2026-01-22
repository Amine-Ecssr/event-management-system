/**
 * Excel Export Service
 * Generates .xlsx files with bilingual support and Arabic RTL layout
 */

import ExcelJS from 'exceljs';
import { ExportOptions, ExportResult, ColumnDefinition, STATUS_COLORS, EXPORT_MIME_TYPES } from './types';

export class ExcelExportService {
  /**
   * Export data to Excel format
   */
  async exportToExcel<T extends Record<string, unknown>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions,
    sheetName = 'Data'
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EventCal';
    workbook.created = new Date();
    workbook.company = 'ECSSR';

    const isRTL = options.language === 'ar';
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: isRTL }],
      properties: {
        defaultColWidth: 15,
        defaultRowHeight: 20,
      },
    });

    // Configure columns based on language
    worksheet.columns = this.buildColumns(columns, options.language);

    // Add and style header row
    const headerRow = worksheet.getRow(1);
    this.styleHeaderRow(headerRow, columns.length);

    // Add data rows with formatting
    data.forEach((item, index) => {
      const rowData = columns.map((col) => this.formatValue(item[col.key], col.type));
      const row = worksheet.addRow(rowData);
      this.styleDataRow(row, index, item, columns);
    });

    // Auto-fit columns
    this.autoFitColumns(worksheet);

    // Add filters
    if (data.length > 0) {
      worksheet.autoFilter = {
        from: 'A1',
        to: { row: 1, column: columns.length },
      };
    }

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: isRTL }];

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().split('T')[0];
    const lang = options.language === 'both' ? 'bilingual' : options.language;

    return {
      filename: `${sheetName.toLowerCase()}_export_${timestamp}_${lang}.xlsx`,
      mimeType: EXPORT_MIME_TYPES.xlsx,
      buffer: Buffer.from(buffer),
      recordCount: data.length,
    };
  }

  /**
   * Export data with multiple sheets (e.g., events with attendees)
   */
  async exportMultiSheet(
    sheets: Array<{
      name: string;
      data: Record<string, unknown>[];
      columns: ColumnDefinition[];
    }>,
    options: ExportOptions
  ): Promise<ExportResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'EventCal';
    workbook.created = new Date();

    const isRTL = options.language === 'ar';

    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.name, {
        views: [{ rightToLeft: isRTL }],
      });

      worksheet.columns = this.buildColumns(sheet.columns, options.language);

      const headerRow = worksheet.getRow(1);
      this.styleHeaderRow(headerRow, sheet.columns.length);

      sheet.data.forEach((item, index) => {
        const rowData = sheet.columns.map((col) => this.formatValue(item[col.key], col.type));
        const row = worksheet.addRow(rowData);
        this.styleDataRow(row, index, item, sheet.columns);
      });

      this.autoFitColumns(worksheet);

      if (sheet.data.length > 0) {
        worksheet.autoFilter = {
          from: 'A1',
          to: { row: 1, column: sheet.columns.length },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().split('T')[0];

    return {
      filename: `multi_export_${timestamp}.xlsx`,
      mimeType: EXPORT_MIME_TYPES.xlsx,
      buffer: Buffer.from(buffer),
      recordCount: sheets.reduce((acc, s) => acc + s.data.length, 0),
    };
  }

  /**
   * Build column definitions based on language preference
   */
  private buildColumns(
    columns: ColumnDefinition[],
    language: ExportOptions['language']
  ): Partial<ExcelJS.Column>[] {
    return columns.map((col) => {
      let header: string;
      if (language === 'both') {
        header = `${col.labelEn}\n${col.labelAr}`;
      } else if (language === 'ar') {
        header = col.labelAr;
      } else {
        header = col.labelEn;
      }

      return {
        header,
        key: col.key,
        width: col.width || 15,
        style: {
          alignment: {
            horizontal: col.align || (language === 'ar' ? 'right' : 'left'),
            vertical: 'middle',
            wrapText: language === 'both',
          },
        },
      };
    });
  }

  /**
   * Style the header row
   */
  private styleHeaderRow(row: ExcelJS.Row, columnCount: number): void {
    row.font = {
      bold: true,
      size: 11,
      color: { argb: 'FFFFFFFF' },
    };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Blue-600
    };
    row.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    row.height = 30;

    // Add borders to header cells
    for (let i = 1; i <= columnCount; i++) {
      const cell = row.getCell(i);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1E40AF' } },
        left: { style: 'thin', color: { argb: 'FF1E40AF' } },
        bottom: { style: 'medium', color: { argb: 'FF1E40AF' } },
        right: { style: 'thin', color: { argb: 'FF1E40AF' } },
      };
    }
  }

  /**
   * Style data rows with conditional formatting
   */
  private styleDataRow(
    row: ExcelJS.Row,
    index: number,
    item: Record<string, unknown>,
    columns: ColumnDefinition[]
  ): void {
    // Alternate row colors
    if (index % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }, // Gray-100
      };
    }

    row.alignment = { vertical: 'middle' };

    // Apply conditional formatting for status/priority columns
    columns.forEach((col, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      const value = item[col.key];

      if (typeof value === 'string') {
        // Check for status-like values
        const normalizedValue = value.toLowerCase().replace(/\s+/g, '_');
        const color = STATUS_COLORS[normalizedValue];
        
        if (color && (col.key.includes('status') || col.key.includes('priority'))) {
          cell.font = { color: { argb: `FF${color}` }, bold: true };
        }
      }

      // Light borders for data cells
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  }

  /**
   * Auto-fit column widths based on content
   */
  private autoFitColumns(worksheet: ExcelJS.Worksheet): void {
    worksheet.columns.forEach((column: Partial<ExcelJS.Column>) => {
      if (!column.eachCell) return;

      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
        const cellValue = cell.value?.toString() || '';
        const lines = cellValue.split('\n');
        const longestLine = Math.max(...lines.map((l: string) => l.length));
        if (longestLine > maxLength) {
          maxLength = Math.min(longestLine, 50);
        }
      });
      column.width = maxLength + 2;
    });
  }

  /**
   * Format a value for Excel based on its type
   */
  private formatValue(value: unknown, type?: string): unknown {
    if (value === null || value === undefined) return '';

    if (type === 'date') {
      if (value instanceof Date) {
        return value;
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date;
      }
    }

    if (type === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (type === 'array' && Array.isArray(value)) {
      return value.join(', ');
    }

    if (type === 'number' && typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }

    return value;
  }
}

// Singleton instance
export const excelExportService = new ExcelExportService();
