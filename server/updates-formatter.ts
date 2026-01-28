import type { Update } from "@shared/schema.mssql";
import { addDays, format } from "date-fns";
import { ar, enUS } from "date-fns/locale";

export type UpdateWithDepartment = Update & {
  departmentName?: string | null;
  departmentNameAr?: string | null;
};

export type UpdateSection = {
  title: string;
  content: string;
  departmentId?: number | null;
};

export function formatUpdatePeriodLabel(
  type: 'weekly' | 'monthly',
  periodStart: string,
  language: 'en' | 'ar' = 'en'
): string {
  const startDate = new Date(periodStart);
  if (isNaN(startDate.getTime())) {
    return periodStart;
  }
  const locale = language === 'ar' ? ar : enUS;

  if (type === 'weekly') {
    const endDate = addDays(startDate, 6);
    const pattern = language === 'ar' ? 'MMM d yyyy' : 'MMM d, yyyy';
    return `${format(startDate, pattern, { locale })} - ${format(endDate, pattern, { locale })}`;
  }

  return format(startDate, 'MMMM yyyy', { locale });
}

export function buildUpdateSections(
  updates: UpdateWithDepartment[],
  language: 'en' | 'ar' = 'en'
): { sections: UpdateSection[]; usedFallback: boolean } {
  const departmentUpdates: UpdateSection[] = updates
    .filter((update) => !!update.departmentId)
    .map((update) => ({
      title:
        language === 'ar'
          ? update.departmentNameAr || update.departmentName || `#${update.departmentId}`
          : update.departmentName || `Department #${update.departmentId}`,
      content: update.content,
      departmentId: update.departmentId,
    }));

  const globalUpdate = updates.find((update) => !update.departmentId);

  if (departmentUpdates.length > 0) {
    if (globalUpdate) {
      departmentUpdates.push({
        title: language === 'ar' ? 'تحديث عام' : 'General Update',
        content: globalUpdate.content,
        departmentId: null,
      });
    }
    return { sections: departmentUpdates, usedFallback: false };
  }

  if (globalUpdate) {
    return {
      sections: [
        {
          title: language === 'ar' ? 'جميع الإدارات' : 'All Departments',
          content: globalUpdate.content,
          departmentId: null,
        },
      ],
      usedFallback: true,
    };
  }

  return { sections: [], usedFallback: false };
}

export function stripHtmlToText(html: string): string {
  let text = html
    .replace(/<\/(p|div|h[1-6])>/gi, '\n\n')
    .replace(/<br\s*\/?>(?=\s*<)/gi, '\n')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n');

  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

export function formatUpdatesWhatsappMessage(options: {
  type: 'weekly' | 'monthly';
  periodLabel: string;
  sections: UpdateSection[];
  language?: 'en' | 'ar';
  template?: string | null;
}): string {
  const { type, periodLabel, sections, language = 'en', template } = options;

  const heading =
    language === 'ar'
      ? type === 'weekly' ? 'المستجدات الأسبوعية' : 'المستجدات الشهرية'
      : type === 'weekly' ? 'Weekly Updates' : 'Monthly Updates';

  const header = `${heading} | ${periodLabel}`;

  const sectionBlocks = sections.map((section) => {
    const bodyText = stripHtmlToText(section.content || '') ||
      (language === 'ar' ? 'لا يوجد محتوى مضاف لهذا القسم.' : 'No content provided for this section.');

    return [`*${section.title}*`, bodyText].join('\n');
  });

  const updatesBody = sectionBlocks.join('\n\n');

  if (template) {
    return template
      .replace(/{{\s*header\s*}}/gi, header)
      .replace(/{{\s*heading\s*}}/gi, heading)
      .replace(/{{\s*period_label\s*}}/gi, periodLabel)
      .replace(/{{\s*period\s*}}/gi, periodLabel)
      .replace(/{{\s*updates\s*}}/gi, updatesBody)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return [header, '', updatesBody].join('\n').trim();
}
