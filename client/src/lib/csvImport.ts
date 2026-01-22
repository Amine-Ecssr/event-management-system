import { InsertEvent } from '@shared/schema';
import Papa from 'papaparse';

export interface CsvRow {
  name?: string;
  nameAr?: string;
  nameArabic?: string;
  description?: string;
  descriptionAr?: string;
  descriptionArabic?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  locationAr?: string;
  locationArabic?: string;
  organizers?: string;
  organizersAr?: string;
  organizersArabic?: string;
  url?: string;
  category?: string;
  categoryAr?: string;
  categoryArabic?: string;
  eventType?: string;
  eventScope?: string;
}

function normalizeHeader(header: string): string {
  // Convert headers like "Event Type", "Start Date", "event_type" to camelCase
  // Also handle special format "Name (Arabic)" -> "nameArabic"
  let normalized = header
    .trim()
    // Handle "(Arabic)" format -> convert to "Arabic" suffix
    .replace(/\s*\(Arabic\)\s*/gi, ' Arabic')
    .replace(/\s*\(Ar\)\s*/gi, ' Ar')
    .toLowerCase()
    .replace(/[_\s]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (char) => char.toLowerCase());
  
  console.log(`Header transformation: "${header}" => "${normalized}"`);
  return normalized;
}

export function parseCSV(csvText: string): CsvRow[] {
  // Extract original headers from first line for debugging
  const lines = csvText.trim().split('\n');
  let originalHeaders: string[] = [];
  
  if (lines.length > 0) {
    // Parse the first line to get original headers
    const headerLine = lines[0];
    const headerResult = Papa.parse(headerLine);
    if (headerResult.data && headerResult.data[0]) {
      originalHeaders = headerResult.data[0] as string[];
    }
  }
  
  // Parse without transformHeader first
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    console.error('CSV Parse Errors:', result.errors);
    throw new Error('Failed to parse CSV file: ' + result.errors.map(e => e.message).join(', '));
  }
  
  // Manually transform the keys of each row to handle header normalization
  const normalizedData: CsvRow[] = result.data.map((row: any) => {
    const normalizedRow: any = {};
    for (const key in row) {
      const normalizedKey = normalizeHeader(key);
      normalizedRow[normalizedKey] = row[key];
    }
    return normalizedRow;
  });
  
  // Log what headers were found for debugging
  console.log('=== CSV Import Debug Info ===');
  console.log('Original CSV Headers:', originalHeaders);
  console.log('Normalized Headers:', originalHeaders.map(normalizeHeader));
  console.log('Expected Headers: name, nameAr/nameArabic, description, descriptionAr/descriptionArabic, startDate, endDate, startTime (optional), endTime (optional), location (optional), locationAr/locationArabic (optional), organizers, organizersAr/organizersArabic, category, categoryAr/categoryArabic, url, eventType, eventScope');
  
  // Log first row for debugging
  if (normalizedData.length > 0) {
    console.log('First CSV row parsed (before normalization):', result.data[0]);
    console.log('First CSV row (after normalization):', normalizedData[0]);
    console.log('Total rows to import:', normalizedData.length);
  }
  console.log('=== End Debug Info ===');

  return normalizedData;
}

export function validateEventRow(row: CsvRow, rowNumber: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Helper to show what we got
  const showValue = (val: any) => val ? `"${val}"` : '(empty)';

  if (!row.name || row.name.trim().length < 3) {
    errors.push(`Row ${rowNumber}: Name is required and must be at least 3 characters. Got: ${showValue(row.name)}`);
  }

  // Description is now optional - no validation needed

  if (!row.startDate) {
    errors.push(`Row ${rowNumber}: Start Date is required. Expected format: YYYY-MM-DD (e.g., 2025-11-15)`);
  } else if (!isValidDate(row.startDate.trim())) {
    errors.push(`Row ${rowNumber}: Start Date must be in YYYY-MM-DD format. Got: ${showValue(row.startDate)}. Expected: 2025-11-15`);
  }

  if (!row.endDate) {
    errors.push(`Row ${rowNumber}: End Date is required. Expected format: YYYY-MM-DD (e.g., 2025-11-17)`);
  } else if (!isValidDate(row.endDate.trim())) {
    errors.push(`Row ${rowNumber}: End Date must be in YYYY-MM-DD format. Got: ${showValue(row.endDate)}. Expected: 2025-11-17`);
  }

  // Location is now optional - no validation needed

  if (row.eventType && row.eventType.trim().length > 0 && !['local', 'international'].includes(row.eventType.toLowerCase().trim())) {
    errors.push(`Row ${rowNumber}: Event Type must be 'local' or 'international' (or leave empty for default 'local'). Got: ${showValue(row.eventType)}`);
  }

  if (row.eventScope && row.eventScope.trim().length > 0 && !['internal', 'external'].includes(row.eventScope.toLowerCase().trim())) {
    errors.push(`Row ${rowNumber}: Event Scope must be 'internal' or 'external' (or leave empty for default 'external'). Got: ${showValue(row.eventScope)}`);
  }

  if (row.url && row.url.trim().length > 0 && !isValidUrl(row.url.trim())) {
    errors.push(`Row ${rowNumber}: URL must be a valid URL starting with http:// or https://. Got: ${showValue(row.url)}`);
  }

  // Time validation (optional fields)
  if (row.startTime && row.startTime.trim().length > 0 && !isValidTime(row.startTime.trim())) {
    errors.push(`Row ${rowNumber}: Start Time must be in HH:MM format (00:00 to 23:59). Got: ${showValue(row.startTime)}`);
  }

  if (row.endTime && row.endTime.trim().length > 0 && !isValidTime(row.endTime.trim())) {
    errors.push(`Row ${rowNumber}: End Time must be in HH:MM format (00:00 to 23:59). Got: ${showValue(row.endTime)}`);
  }

  // Validate end date >= start date
  if (row.startDate && row.endDate && isValidDate(row.startDate.trim()) && isValidDate(row.endDate.trim())) {
    const startDate = new Date(row.startDate.trim());
    const endDate = new Date(row.endDate.trim());
    if (endDate < startDate) {
      errors.push(`Row ${rowNumber}: End date must be on or after start date`);
    }
  }

  // Validate end time > start time for same-day events
  if (row.startDate && row.endDate && row.startTime && row.endTime &&
      row.startDate.trim() === row.endDate.trim() &&
      row.startTime.trim().length > 0 && row.endTime.trim().length > 0 &&
      isValidTime(row.startTime.trim()) && isValidTime(row.endTime.trim())) {
    if (row.endTime.trim() <= row.startTime.trim()) {
      errors.push(`Row ${rowNumber}: End time must be after start time for same-day events`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidTime(timeString: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeString);
}

export function csvRowToEvent(row: CsvRow): Partial<InsertEvent> {
  const eventTypeValue = row.eventType?.toLowerCase().trim();
  const eventScopeValue = row.eventScope?.toLowerCase().trim();
  
  // Handle both "nameAr" and "nameArabic" header formats
  const nameAr = row.nameAr?.trim() || row.nameArabic?.trim() || undefined;
  const descriptionAr = row.descriptionAr?.trim() || row.descriptionArabic?.trim() || undefined;
  const locationAr = row.locationAr?.trim() || row.locationArabic?.trim() || undefined;
  const organizersAr = row.organizersAr?.trim() || row.organizersArabic?.trim() || undefined;
  const categoryAr = row.categoryAr?.trim() || row.categoryArabic?.trim() || undefined;
  
  return {
    name: row.name?.trim() || '',
    nameAr: nameAr,
    description: row.description?.trim() || undefined, // Optional description
    descriptionAr: descriptionAr,
    startDate: row.startDate?.trim() || '',
    endDate: row.endDate?.trim() || '',
    startTime: row.startTime?.trim() || undefined,
    endTime: row.endTime?.trim() || undefined,
    location: row.location?.trim() || undefined, // Optional location
    locationAr: locationAr,
    organizers: row.organizers?.trim() || undefined,
    organizersAr: organizersAr,
    url: row.url?.trim() || undefined,
    category: row.category?.trim() || undefined,
    categoryAr: categoryAr,
    eventType: (eventTypeValue === 'local' || eventTypeValue === 'international') ? eventTypeValue : 'local',
    eventScope: (eventScopeValue === 'internal' || eventScopeValue === 'external') ? eventScopeValue : 'external',
  };
}
