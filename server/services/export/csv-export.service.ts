/**
 * CSV Export Service
 * Generates CSV files with UTF-8 BOM for Excel Arabic compatibility
 */

import { stringify } from 'csv-stringify/sync';
import { ExportOptions, ExportResult, ColumnDefinition, EXPORT_MIME_TYPES } from './types';

export class CSVExportService {
  /**
   * Export data to CSV format
   */
  async exportToCSV<T extends Record<string, unknown>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions
  ): Promise<ExportResult> {
    // Build headers based on language
    const headers = columns.map((col) => {
      if (options.language === 'both') {
        return `${col.labelEn} / ${col.labelAr}`;
      }
      if (options.language === 'ar') {
        return col.labelAr;
      }
      return col.labelEn;
    });

    // Transform data to array format
    const rows = data.map((item) =>
      columns.map((col) => this.formatValue(item[col.key], col.type))
    );

    // Generate CSV with BOM for Excel Arabic support
    const csvContent = stringify([headers, ...rows], {
      bom: true, // UTF-8 BOM for Excel compatibility
      delimiter: ',',
      quote: '"',
      escape: '"',
      record_delimiter: '\r\n', // Windows-style for Excel
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const lang = options.language === 'both' ? 'bilingual' : options.language;
    const title = options.title || 'data';

    return {
      filename: `${title.toLowerCase()}_export_${timestamp}_${lang}.csv`,
      mimeType: EXPORT_MIME_TYPES.csv,
      buffer: Buffer.from(csvContent, 'utf-8'),
      recordCount: data.length,
    };
  }

  /**
   * Export data to TSV (Tab-Separated Values) format
   * Useful for certain applications that prefer tabs over commas
   */
  async exportToTSV<T extends Record<string, unknown>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const headers = columns.map((col) => {
      if (options.language === 'both') {
        return `${col.labelEn} / ${col.labelAr}`;
      }
      if (options.language === 'ar') {
        return col.labelAr;
      }
      return col.labelEn;
    });

    const rows = data.map((item) =>
      columns.map((col) => this.formatValue(item[col.key], col.type))
    );

    const tsvContent = stringify([headers, ...rows], {
      bom: true,
      delimiter: '\t',
      quote: '"',
      escape: '"',
      record_delimiter: '\r\n',
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const title = options.title || 'data';

    return {
      filename: `${title.toLowerCase()}_export_${timestamp}.tsv`,
      mimeType: 'text/tab-separated-values; charset=utf-8',
      buffer: Buffer.from(tsvContent, 'utf-8'),
      recordCount: data.length,
    };
  }

  /**
   * Format a value for CSV output
   */
  private formatValue(value: unknown, type?: string): string {
    if (value === null || value === undefined) return '';

    if (type === 'date') {
      if (value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toISOString().split('T')[0];
      }
    }

    if (type === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (type === 'array' && Array.isArray(value)) {
      return value.join('; ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }
}

// Singleton instance
export const csvExportService = new CSVExportService();
