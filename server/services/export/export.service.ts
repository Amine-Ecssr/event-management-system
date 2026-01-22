/**
 * Main Export Service
 * Orchestrates data fetching and export generation for all entity types
 */

import { storage } from '../../repositories';
import { excelExportService } from './excel-export.service';
import { csvExportService } from './csv-export.service';
import { pdfExportService } from './pdf-export.service';
import {
  ExportOptions,
  ExportResult,
  ColumnDefinition,
  ExportJob,
  ExportEntityType,
  ExportJobStatus,
} from './types';

// ============================================================
// Column Definitions for Each Entity Type
// ============================================================

const EVENT_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', width: 10 },
  { key: 'name', labelEn: 'Name', labelAr: 'الاسم', width: 30 },
  { key: 'nameAr', labelEn: 'Name (Arabic)', labelAr: 'الاسم بالعربية', width: 30 },
  { key: 'startDate', labelEn: 'Start Date', labelAr: 'تاريخ البداية', type: 'date', width: 12 },
  { key: 'endDate', labelEn: 'End Date', labelAr: 'تاريخ النهاية', type: 'date', width: 12 },
  { key: 'startTime', labelEn: 'Start Time', labelAr: 'وقت البداية', width: 10 },
  { key: 'endTime', labelEn: 'End Time', labelAr: 'وقت النهاية', width: 10 },
  { key: 'category', labelEn: 'Category', labelAr: 'الفئة', width: 15 },
  { key: 'eventType', labelEn: 'Type', labelAr: 'النوع', width: 12 },
  { key: 'eventScope', labelEn: 'Scope', labelAr: 'النطاق', width: 12 },
  { key: 'location', labelEn: 'Location', labelAr: 'الموقع', width: 20 },
  { key: 'organizers', labelEn: 'Organizers', labelAr: 'المنظمون', width: 25 },
  { key: 'expectedAttendance', labelEn: 'Expected Attendance', labelAr: 'الحضور المتوقع', type: 'number', width: 15 },
  { key: 'isArchived', labelEn: 'Archived', labelAr: 'مؤرشف', type: 'boolean', width: 10 },
];

const TASK_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number', width: 8 },
  { key: 'title', labelEn: 'Title', labelAr: 'العنوان', width: 35 },
  { key: 'status', labelEn: 'Status', labelAr: 'الحالة', width: 12 },
  { key: 'priority', labelEn: 'Priority', labelAr: 'الأولوية', width: 10 },
  { key: 'dueDate', labelEn: 'Due Date', labelAr: 'تاريخ الاستحقاق', type: 'date', width: 12 },
  { key: 'departmentName', labelEn: 'Assigned To (Department)', labelAr: 'مسند إلى (القسم)', width: 25 },
  { key: 'eventName', labelEn: 'Event', labelAr: 'الفعالية', width: 30 },
  { key: 'createdAt', labelEn: 'Created', labelAr: 'تاريخ الإنشاء', type: 'date', width: 12 },
];

const CONTACT_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number', width: 8 },
  { key: 'nameEn', labelEn: 'Name', labelAr: 'الاسم', width: 25 },
  { key: 'nameAr', labelEn: 'Name (Arabic)', labelAr: 'الاسم بالعربية', width: 25 },
  { key: 'email', labelEn: 'Email', labelAr: 'البريد الإلكتروني', width: 30 },
  { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف', width: 15 },
  { key: 'organizationName', labelEn: 'Organization', labelAr: 'المنظمة', width: 25 },
  { key: 'positionName', labelEn: 'Position', labelAr: 'المنصب', width: 20 },
  { key: 'countryName', labelEn: 'Country', labelAr: 'الدولة', width: 15 },
  { key: 'title', labelEn: 'Title', labelAr: 'اللقب', width: 15 },
  { key: 'isEligibleSpeaker', labelEn: 'Eligible Speaker', labelAr: 'متحدث مؤهل', type: 'boolean', width: 12 },
];

const ORGANIZATION_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number', width: 8 },
  { key: 'nameEn', labelEn: 'Name', labelAr: 'الاسم', width: 30 },
  { key: 'nameAr', labelEn: 'Name (Arabic)', labelAr: 'الاسم بالعربية', width: 30 },
  { key: 'countryName', labelEn: 'Country', labelAr: 'الدولة', width: 15 },
  { key: 'website', labelEn: 'Website', labelAr: 'الموقع الإلكتروني', width: 30 },
  { key: 'contactCount', labelEn: 'Contacts', labelAr: 'جهات الاتصال', type: 'number', width: 10 },
  { key: 'isPartner', labelEn: 'Is Partner', labelAr: 'شريك', type: 'boolean', width: 12 },
];

const PARTNERSHIP_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number', width: 8 },
  { key: 'organizationName', labelEn: 'Organization', labelAr: 'المنظمة', width: 30 },
  { key: 'partnershipType', labelEn: 'Type', labelAr: 'النوع', width: 15 },
  { key: 'status', labelEn: 'Status', labelAr: 'الحالة', width: 12 },
  { key: 'startDate', labelEn: 'Start Date', labelAr: 'تاريخ البداية', type: 'date', width: 12 },
  { key: 'endDate', labelEn: 'End Date', labelAr: 'تاريخ النهاية', type: 'date', width: 12 },
  { key: 'primaryContactName', labelEn: 'Primary Contact', labelAr: 'جهة الاتصال الرئيسية', width: 25 },
  { key: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات', width: 40 },
];

const LEAD_COLUMNS: ColumnDefinition[] = [
  { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'number', width: 8 },
  { key: 'name', labelEn: 'Name', labelAr: 'الاسم', width: 25 },
  { key: 'email', labelEn: 'Email', labelAr: 'البريد الإلكتروني', width: 30 },
  { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف', width: 15 },
  { key: 'organizationName', labelEn: 'Organization', labelAr: 'المنظمة', width: 30 },
  { key: 'type', labelEn: 'Type', labelAr: 'النوع', width: 12 },
  { key: 'status', labelEn: 'Status', labelAr: 'الحالة', width: 12 },
  { key: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات', width: 40 },
  { key: 'createdAt', labelEn: 'Created', labelAr: 'تاريخ الإنشاء', type: 'date', width: 12 },
];

// ============================================================
// Job Queue (in-memory for development, use Redis in production)
// ============================================================

const exportJobs = new Map<string, ExportJob>();

// Clean up old jobs every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [jobId, job] of Array.from(exportJobs.entries())) {
    if (job.completedAt && job.completedAt < oneHourAgo) {
      exportJobs.delete(jobId);
    }
  }
}, 60 * 60 * 1000);

// ============================================================
// Main Export Service
// ============================================================

export class ExportService {
  // -------------------- Events Export --------------------
  
  async exportEvents(options: ExportOptions): Promise<ExportResult> {
    const events = await storage.getAllEvents();
    
    // Transform data for export
    const exportData = events.map((event) => ({
      ...event,
      category: event.category || '',
      eventType: event.eventType || '',
      eventScope: event.eventScope || '',
      location: event.location || '',
      organizers: event.organizers || '',
    }));
    
    return this.export(exportData, EVENT_COLUMNS, { ...options, title: 'Events' });
  }

  async exportArchivedEvents(options: ExportOptions): Promise<ExportResult> {
    const { events: archived } = await storage.getAllArchivedEvents();
    
    const exportData = archived.map((event) => ({
      id: event.id,
      name: event.name,
      nameAr: event.nameAr || '',
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      category: event.category || '',
      eventType: event.eventType || '',
      eventScope: event.eventScope || '',
      location: event.location || '',
      organizers: event.organizers || '',
      actualAttendees: event.actualAttendees || 0,
      isArchived: true,
    }));
    
    return this.export(exportData, EVENT_COLUMNS, { ...options, title: 'Archived Events' });
  }

  // -------------------- Tasks Export --------------------
  
  async exportTasks(options: ExportOptions): Promise<ExportResult> {
    const allTasks = await storage.getAllTasksForAdminDashboard();

    // Transform tasks with related data
    // Note: Tasks are assigned to departments, not individual users
    const exportData = allTasks.map((item) => ({
      id: item.task.id,
      title: item.task.title,
      status: item.task.status,
      priority: item.task.priority,
      dueDate: item.task.dueDate,
      departmentName: item.department?.name || '-',
      eventName: item.event?.name || '-',
      createdAt: item.task.createdAt,
    }));

    return this.export(exportData, TASK_COLUMNS, { ...options, title: 'Tasks' });
  }

  async exportOverdueTasks(options: ExportOptions): Promise<ExportResult> {
    const allTasks = await storage.getAllTasksForAdminDashboard();
    const now = new Date();

    // Filter to overdue tasks only
    const overdueTasks = allTasks.filter((item) => {
      const dueDate = item.task.dueDate ? new Date(item.task.dueDate) : null;
      return dueDate && dueDate < now && item.task.status !== 'completed';
    });

    // Transform tasks with related data
    // Note: Tasks are assigned to departments, not individual users
    const exportData = overdueTasks.map((item) => ({
      id: item.task.id,
      title: item.task.title,
      status: item.task.status,
      priority: item.task.priority,
      dueDate: item.task.dueDate,
      departmentName: item.department?.name || '-',
      eventName: item.event?.name || '-',
      createdAt: item.task.createdAt,
    }));

    return this.export(exportData, TASK_COLUMNS, { ...options, title: 'Overdue Tasks' });
  }

  // -------------------- Contacts Export --------------------
  
  async exportContacts(options: ExportOptions): Promise<ExportResult> {
    const { contacts } = await storage.getAllContacts();
    
    const exportData = contacts.map((contact) => ({
      id: contact.id,
      nameEn: contact.nameEn || '',
      nameAr: contact.nameAr || '',
      email: contact.email || '',
      phone: contact.phone || '',
      organizationName: contact.organization?.nameEn || '-',
      positionName: contact.position?.nameEn || '-',
      countryName: contact.country?.nameEn || '-',
      title: contact.title || '',
      isEligibleSpeaker: contact.isEligibleSpeaker || false,
    }));
    
    return this.export(exportData, CONTACT_COLUMNS, { ...options, title: 'Contacts' });
  }

  async exportSpeakers(options: ExportOptions): Promise<ExportResult> {
    const speakers = await storage.getEligibleSpeakers();
    
    const exportData = speakers.map((contact) => ({
      id: contact.id,
      nameEn: contact.nameEn || '',
      nameAr: contact.nameAr || '',
      email: contact.email || '',
      phone: contact.phone || '',
      organizationName: contact.organization?.nameEn || '-',
      positionName: contact.position?.nameEn || '-',
      countryName: contact.country?.nameEn || '-',
      title: contact.title || '',
      isEligibleSpeaker: true,
    }));
    
    return this.export(exportData, CONTACT_COLUMNS, { ...options, title: 'Speakers' });
  }

  // -------------------- Organizations Export --------------------
  
  async exportOrganizations(options: ExportOptions): Promise<ExportResult> {
    const organizations = await storage.getAllOrganizations();

    // Get contact counts for all organizations
    const contactCounts = await storage.getOrganizationContactCounts();
    const contactCountMap = new Map(contactCounts.map(c => [c.organizationId, c.count]));

    const exportData = organizations.map((org) => ({
      id: org.id,
      nameEn: org.nameEn || '',
      nameAr: org.nameAr || '',
      countryName: org.country?.nameEn || '-',
      website: org.website || '',
      contactCount: contactCountMap.get(org.id) || 0,
      isPartner: org.isPartner || false,
    }));

    return this.export(exportData, ORGANIZATION_COLUMNS, { ...options, title: 'Organizations' });
  }

  // -------------------- Partnerships Export --------------------
  
  async exportPartnerships(options: ExportOptions): Promise<ExportResult> {
    const { partners } = await storage.getAllPartners();

    // Get all partnership types
    const partnershipTypes = await storage.getAllPartnershipTypes();
    const typeMap = new Map(partnershipTypes.map(t => [t.id, t.nameEn]));

    // Get all unique primary contact IDs
    const contactIds = [...new Set(partners.map(p => p.primaryContactId).filter(Boolean))];

    // Fetch contacts in batch
    const contacts = await Promise.all(contactIds.map(id => storage.getContactById(id!)));
    const contactMap = new Map(contacts.filter(Boolean).map(c => [c!.id, c!.nameEn || c!.nameAr || '']));

    const exportData = partners.map((p) => ({
      id: p.id,
      organizationName: p.nameEn || '-',
      partnershipType: p.partnershipTypeId ? (typeMap.get(p.partnershipTypeId) || '-') : '-',
      status: p.partnershipStatus || '',
      startDate: p.partnershipStartDate,
      endDate: p.partnershipEndDate,
      primaryContactName: p.primaryContactId ? (contactMap.get(p.primaryContactId) || '-') : '-',
      notes: p.partnershipNotes || '',
    }));

    return this.export(exportData, PARTNERSHIP_COLUMNS, { ...options, title: 'Partnerships' });
  }

  // -------------------- Leads Export --------------------
  
  async exportLeads(options: ExportOptions): Promise<ExportResult> {
    const leads = await storage.getAllLeads();

    const exportData = leads.map((lead) => ({
      id: lead.id,
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      organizationName: lead.organizationName || '-',
      type: lead.type || '',
      status: lead.status || '',
      notes: lead.notes || '',
      createdAt: lead.createdAt,
    }));

    return this.export(exportData, LEAD_COLUMNS, { ...options, title: 'Leads' });
  }

  // -------------------- Generic Export Method --------------------
  
  private async export<T extends Record<string, unknown>>(
    data: T[],
    columns: ColumnDefinition[],
    options: ExportOptions
  ): Promise<ExportResult> {
    // Filter columns if specified
    const filteredColumns = options.columns
      ? columns.filter((c) => options.columns!.includes(c.key))
      : columns;

    const title = options.title || 'Data';

    switch (options.format) {
      case 'xlsx':
        return excelExportService.exportToExcel(data, filteredColumns, options, title);
      case 'csv':
        return csvExportService.exportToCSV(data, filteredColumns, { ...options, title });
      case 'pdf':
        return pdfExportService.exportToPDF(data, filteredColumns, options, title);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  // -------------------- Job Queue (for large exports) --------------------
  
  async queueExport(
    type: ExportEntityType,
    options: ExportOptions
  ): Promise<string> {
    const jobId = `export-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const job: ExportJob = {
      id: jobId,
      type,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      options,
    };

    exportJobs.set(jobId, job);

    // Process async (don't await)
    this.processJob(jobId, type, options).catch((error) => {
      console.error(`[Export] Job ${jobId} failed:`, error);
      const j = exportJobs.get(jobId);
      if (j) {
        j.status = 'failed';
        j.error = error instanceof Error ? error.message : 'Unknown error';
        j.completedAt = new Date();
      }
    });

    return jobId;
  }

  private async processJob(
    jobId: string,
    type: ExportEntityType,
    options: ExportOptions
  ): Promise<void> {
    const job = exportJobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    job.progress = 10;

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
      case 'organizations':
        result = await this.exportOrganizations(options);
        break;
      case 'leads':
        result = await this.exportLeads(options);
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    job.progress = 90;

    // In production, upload to MinIO and get signed URL
    // For now, store in memory (limited time)
    // const objectKey = `exports/${jobId}/${result.filename}`;
    // await uploadBuffer(result.buffer!, 'eventcal-exports', objectKey, result.mimeType);
    // const url = await getSignedUrl('eventcal-exports', objectKey, 86400);

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    // job.downloadUrl = url;
  }

  getJobStatus(jobId: string): ExportJob | undefined {
    return exportJobs.get(jobId);
  }

  getAllJobs(): ExportJob[] {
    return Array.from(exportJobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  cancelJob(jobId: string): boolean {
    const job = exportJobs.get(jobId);
    if (job && job.status === 'pending') {
      job.status = 'failed';
      job.error = 'Cancelled by user';
      job.completedAt = new Date();
      return true;
    }
    return false;
  }
}

// Singleton instance
export const exportService = new ExportService();
