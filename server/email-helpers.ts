import type { Event, Stakeholder, StakeholderRequirement } from '@shared/schema.mssql';
import { format } from 'date-fns';

/**
 * Parse comma-separated email list and combine with global CC
 */
export function getCombinedCcList(
  specificCc: string | null | undefined,
  globalCc: string | null | undefined
): string[] {
  const ccList: string[] = [];
  
  if (globalCc) {
    ccList.push(...globalCc.split(',').map(e => e.trim()).filter(e => e));
  }
  
  if (specificCc) {
    ccList.push(...specificCc.split(',').map(e => e.trim()).filter(e => e));
  }
  
  // Remove duplicates
  return Array.from(new Set(ccList));
}

/**
 * Replace template variables in a string
 */
export function replaceTemplateVariables(
  template: string,
  event: Event,
  stakeholder?: Stakeholder,
  additionalVars?: Record<string, string>,
  isArabic: boolean = false
): string {
  const startDate = format(new Date(event.startDate), 'MMM dd, yyyy');
  const endDate = format(new Date(event.endDate), 'MMM dd, yyyy');
  
  // Use Arabic fields when isArabic is true, fallback to English fields if Arabic not available
  const replacements: Record<string, string> = {
    eventName: isArabic ? (event.nameAr || event.name || '') : (event.name || ''),
    description: isArabic ? (event.descriptionAr || event.description || '') : (event.description || ''),
    startDate,
    endDate,
    location: isArabic ? (event.locationAr || event.location || '') : (event.location || ''),
    organizers: isArabic ? (event.organizersAr || event.organizers || '') : (event.organizers || ''),
    category: isArabic ? (event.categoryAr || event.category || '') : (event.category || ''),
    eventType: event.eventType === 'international' ? (isArabic ? 'دولي' : 'International') : (isArabic ? 'محلي' : 'Local'),
    eventTypeRaw: event.eventType || '',
    eventScope: event.eventScope === 'external' ? (isArabic ? 'خارجي' : 'External') : (isArabic ? 'داخلي' : 'Internal'),
    eventScopeRaw: event.eventScope || '',
    url: event.url || '',
    expectedAttendance: event.expectedAttendance?.toString() || '',
    name: isArabic ? (stakeholder?.nameAr || stakeholder?.name || '') : (stakeholder?.name || ''),
    stakeholderName: isArabic ? (stakeholder?.nameAr || stakeholder?.name || '') : (stakeholder?.name || ''),
    ...additionalVars, // Merge any additional variables
  };
  
  let result = template;
  Object.entries(replacements).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  });
  
  return result;
}

/**
 * Format a requirement item using a template
 */
export function formatRequirementItem(
  req: StakeholderRequirement,
  index: number,
  template?: string | null,
  isArabic: boolean = false
): string {
  // Default template with formatting
  const defaultTemplate = `
    <li style="margin-bottom: 8px;">
      <strong>{{title}}</strong>
      ${req.description || req.descriptionAr ? `<br><span style="opacity: 0.8; font-size: 14px;">{{description}}</span>` : ''}
    </li>
  `;
  
  const itemTemplate = template || defaultTemplate;
  const number = (index + 1).toString();
  
  // Use Arabic fields when isArabic is true, fallback to English fields if Arabic not available
  const title = isArabic ? (req.titleAr || req.title || '') : (req.title || '');
  const description = isArabic ? (req.descriptionAr || req.description || '') : (req.description || '');
  
  // Replace template variables with raw values, allowing template to control formatting
  let result = itemTemplate
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, description)
    .replace(/\{\{index\}\}/g, index.toString())
    .replace(/\{\{number\}\}/g, number);
  
  return result;
}
