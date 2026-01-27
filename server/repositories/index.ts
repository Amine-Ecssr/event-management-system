/**
 * Storage Facade
 * Main entry point for all database operations
 * Re-exports the Storage class that composes all repositories
 */
import session from 'express-session';
import createMemoryStore from "memorystore"; 
import connectPgSimple from 'connect-pg-simple';
import { type InsertArchivedEvent, type ArchivedEvent } from '@shared/schema.mssql';

// Import all repositories
import { UserRepository } from './user-repository';
import { EventRepository } from './event-repository';
import { CategoryRepository } from './category-repository';
import { SettingsRepository } from './settings-repository';
import { ReminderRepository } from './reminder-repository';
import { UpdateRepository } from './update-repository';
import { DepartmentRepository } from './department-repository';
import { TaskRepository } from './task-repository';
import { ArchiveRepository } from './archive-repository';
import { MediaRepository } from './media-repository';
import { ContactRepository } from './contact-repository';
import { InvitationRepository } from './invitation-repository';
import { WorkflowRepository } from './workflow-repository';
import { PartnershipRepository } from './partnership-repository';
import { LeadRepository } from './lead-repository';
import { AuthRepository } from './auth-repository';
import { AiChatRepository } from './ai-chat-repository';

// Re-export types
export * from './types';

// Session store configuration
// - postgres: uses connect-pg-simple (existing behavior)
// - mssql: uses memorystore (in-memory) for Phase 2 so the app can run without Postgres.
//   For production with MSSQL, we will switch to Redis or an MSSQL-backed session store in Phase 3/4.
const DIALECT = (process.env.DB_DIALECT || "postgres").toLowerCase();
export const sessionStore: session.Store =
  DIALECT === "postgres"
    ? (() => {
        const PgStore = connectPgSimple(session);
        return new PgStore({
          conString: process.env.DATABASE_URL,
          tableName: "sessions", // Match the table name from our schema
          createTableIfMissing: false, // Sessions table is managed by Drizzle ORM
        });
      })()
    : (() => {
        const MemoryStore = createMemoryStore(session);
        return new MemoryStore({
          checkPeriod: 24 * 60 * 60 * 1000, // prune expired entries every 24h
        });
      })();
/**
 * Storage class that delegates to individual repositories
 * Implements the IStorage interface
 */
export class Storage {
  // Session store for authentication
  public sessionStore: session.Store;

  // Repository instances
  private userRepo = new UserRepository();
  private eventRepo = new EventRepository();
  private categoryRepo = new CategoryRepository();
  private settingsRepo = new SettingsRepository();
  private reminderRepo = new ReminderRepository();

  constructor() {
    // Initialize session store
    this.sessionStore = sessionStore;
  }
  private updateRepo = new UpdateRepository();
  private departmentRepo = new DepartmentRepository();
  private taskRepo = new TaskRepository();
  private archiveRepo = new ArchiveRepository();
  private mediaRepo = new MediaRepository();
  private contactRepo = new ContactRepository();
  private invitationRepo = new InvitationRepository();
  private workflowRepo = new WorkflowRepository();
  private partnershipRepo = new PartnershipRepository();
  private leadRepo = new LeadRepository();
  private authRepo = new AuthRepository();
  private aiChatRepo = new AiChatRepository();

  // ==================== User Operations ====================
  getUser = (id: number) => this.userRepo.getUser(id);
  getUserByUsername = (username: string) => this.userRepo.getUserByUsername(username);
  getAllUsers = () => this.userRepo.getAllUsers();
  createUser = (data: Parameters<UserRepository['createUser']>[0]) => this.userRepo.createUser(data);
  updateUserPassword = (id: number, hashedPassword: string) => this.userRepo.updateUserPassword(id, hashedPassword);
  updateUserRole = (id: number, role: Parameters<UserRepository['updateUserRole']>[1]) => this.userRepo.updateUserRole(id, role);
  deleteUser = (id: number) => this.userRepo.deleteUser(id);

  // ==================== Auth Operations ====================
  getUserByKeycloakId = (keycloakId: string) => this.authRepo.getUserByKeycloakId(keycloakId);
  createUserFromKeycloak = (data: Parameters<AuthRepository['createUserFromKeycloak']>[0]) => this.authRepo.createUserFromKeycloak(data);
  updateUserFromKeycloak = (userId: number, data: Parameters<AuthRepository['updateUserFromKeycloak']>[1]) => this.authRepo.updateUserFromKeycloak(userId, data);
  getUsersByDepartmentName = (departmentName: string) => this.authRepo.getUsersByDepartmentName(departmentName);

  // ==================== Event Operations ====================
  getAllEvents = () => this.eventRepo.getAllEvents();
  getEvent = (id: string) => this.eventRepo.getEvent(id);
  createEvent = (data: Parameters<EventRepository['createEvent']>[0]) => this.eventRepo.createEvent(data);
  updateEvent = (id: string, data: Parameters<EventRepository['updateEvent']>[1]) => this.eventRepo.updateEvent(id, data);
  deleteEvent = (id: string) => this.eventRepo.deleteEvent(id);
  deleteAllEvents = () => this.eventRepo.deleteAllEvents();

  // ==================== Category Operations ====================
  getCategories = () => this.categoryRepo.getCategories();
  getCategoryById = (id: number) => this.categoryRepo.getCategoryById(id);
  getCategoryByName = (name: string) => this.categoryRepo.getCategoryByName(name);
  createCategory = (data: Parameters<CategoryRepository['createCategory']>[0]) => this.categoryRepo.createCategory(data);
  updateCategory = (id: number, data: Parameters<CategoryRepository['updateCategory']>[1]) => this.categoryRepo.updateCategory(id, data);
  deleteCategory = (id: number) => this.categoryRepo.deleteCategory(id);

  // ==================== Settings Operations ====================
  getSettings = () => this.settingsRepo.getSettings();
  updateSettings = (data: Parameters<SettingsRepository['updateSettings']>[0]) => this.settingsRepo.updateSettings(data);

  // ==================== Reminder Operations ====================
  enqueueReminder = (data: Parameters<ReminderRepository['enqueueReminder']>[0]) => this.reminderRepo.enqueueReminder(data);
  getPendingReminders = (beforeTime: Date) => this.reminderRepo.getPendingReminders(beforeTime);
  markReminderSent = (id: number) => this.reminderRepo.markReminderSent(id);
  markReminderError = (id: number, error: string, isFinal?: boolean) => this.reminderRepo.markReminderError(id, error, isFinal);
  deleteRemindersForEvent = (eventId: string) => this.reminderRepo.deleteRemindersForEvent(eventId);
  getAllRemindersWithEvents = () => this.reminderRepo.getAllRemindersWithEvents();
  resetReminderForResend = (id: number, scheduledFor: Date) => this.reminderRepo.resetReminderForResend(id, scheduledFor);
  getReminder = (id: number) => this.reminderRepo.getReminder(id);
  deleteReminder = (id: number) => this.reminderRepo.deleteReminder(id);

  // ==================== Update Operations ====================
  getUpdate = (type: 'weekly' | 'monthly', periodStart: string) => this.updateRepo.getUpdate(type, periodStart);
  getUpdateForDepartment = (type: 'weekly' | 'monthly', periodStart: string, departmentId: number) => 
    this.updateRepo.getUpdateForDepartment(type, new Date(periodStart), departmentId);
  getLatestUpdate = (type: 'weekly' | 'monthly') => this.updateRepo.getLatestUpdate(type);
  getLatestUpdateForDepartment = (type: 'weekly' | 'monthly', departmentId: number) => 
    this.updateRepo.getLatestUpdateForDepartment(type, departmentId);
  getAllUpdates = (type: 'weekly' | 'monthly') => this.updateRepo.getAllUpdates(type);
  getAllUpdatesForDepartment = (type: 'weekly' | 'monthly', departmentId: number) => 
    this.updateRepo.getAllUpdatesForDepartment(type, departmentId);
  getUpdatesForPeriodWithDepartments = (type: 'weekly' | 'monthly', periodStart: string) => 
    this.updateRepo.getUpdatesForPeriodWithDepartments(type, periodStart);
  createOrUpdateUpdate = (data: Parameters<UpdateRepository['createOrUpdateUpdate']>[0]) => this.updateRepo.createOrUpdateUpdate(data);

  // ==================== Department Operations ====================
  getAllDepartments = () => this.departmentRepo.getAllDepartments();
  getDepartment = (id: number) => this.departmentRepo.getDepartment(id);
  getDepartmentsWithoutAccounts = () => this.departmentRepo.getDepartmentsWithoutAccounts();
  createDepartment = (data: Parameters<DepartmentRepository['createDepartment']>[0]) => this.departmentRepo.createDepartment(data);
  updateDepartment = (id: number, data: Parameters<DepartmentRepository['updateDepartment']>[1]) => this.departmentRepo.updateDepartment(id, data);
  deleteDepartment = (id: number) => this.departmentRepo.deleteDepartment(id);
  getDepartmentEmails = (departmentId: number) => this.departmentRepo.getDepartmentEmails(departmentId);
  createDepartmentEmail = (data: Parameters<DepartmentRepository['createDepartmentEmail']>[0]) => this.departmentRepo.createDepartmentEmail(data);
  updateDepartmentEmail = (id: number, data: Parameters<DepartmentRepository['updateDepartmentEmail']>[1]) => this.departmentRepo.updateDepartmentEmail(id, data);
  deleteDepartmentEmail = (id: number) => this.departmentRepo.deleteDepartmentEmail(id);
  getDepartmentRequirements = (departmentId: number) => this.departmentRepo.getDepartmentRequirements(departmentId);
  getRequirementById = (id: number) => this.departmentRepo.getRequirementById(id);
  createDepartmentRequirement = (data: Parameters<DepartmentRepository['createDepartmentRequirement']>[0]) => this.departmentRepo.createDepartmentRequirement(data);
  updateDepartmentRequirement = (id: number, data: Parameters<DepartmentRepository['updateDepartmentRequirement']>[1]) => this.departmentRepo.updateDepartmentRequirement(id, data);
  deleteDepartmentRequirement = (id: number) => this.departmentRepo.deleteDepartmentRequirement(id);
  getEventDepartments = (eventId: string) => this.departmentRepo.getEventDepartments(eventId);
  getEventDepartment = (eventDepartmentId: number) => this.departmentRepo.getEventDepartment(eventDepartmentId);
  getEventDepartmentByEventAndDepartment = (eventId: string, departmentId: number) => this.departmentRepo.getEventDepartmentByEventAndDepartment(eventId, departmentId);
  getEventDepartmentsByDepartmentId = (eventId: string, departmentId: number) => this.departmentRepo.getEventDepartmentsByDepartmentId(eventId, departmentId);
  getEventDepartmentsWithDetails = (eventId: string) => this.departmentRepo.getEventDepartmentsWithDetails(eventId, this.taskRepo);
  getAllEventDepartmentsForAdmin = () => this.departmentRepo.getAllEventDepartmentsForAdmin();
  createEventDepartment = (data: Parameters<DepartmentRepository['createEventDepartment']>[0]) => this.departmentRepo.createEventDepartment(data);
  deleteEventDepartments = (eventId: string) => this.departmentRepo.deleteEventDepartments(eventId);
  getDepartmentAccountByUserId = (userId: number) => this.departmentRepo.getDepartmentAccountByUserId(userId);
  getAllDepartmentAccounts = () => this.departmentRepo.getAllDepartmentAccounts();
  createDepartmentAccount = (data: Parameters<DepartmentRepository['createDepartmentAccount']>[0]) => this.departmentRepo.createDepartmentAccount(data);
  updateDepartmentAccountLastLogin = (userId: number) => this.departmentRepo.updateDepartmentAccountLastLogin(userId);
  createAuthIdentity = (data: Parameters<DepartmentRepository['createAuthIdentity']>[0]) => this.departmentRepo.createAuthIdentity(data);
  getDepartmentByKeycloakGroupId = (keycloakGroupId: string) => this.departmentRepo.getDepartmentByKeycloakGroupId(keycloakGroupId);
  getUserDepartments = (userId: number) => this.departmentRepo.getUserDepartments(userId);
  getOrCreateDepartmentByName = (name: string, keycloakGroupId?: string) => this.departmentRepo.getOrCreateDepartmentByName(name, keycloakGroupId);
  linkUserToDepartment = (userId: number, departmentId: number, primaryEmailId: number) => this.departmentRepo.linkUserToDepartment(userId, departmentId, primaryEmailId);

  // ==================== Task Operations ====================
  getTasksByEventDepartment = (eventDepartmentId: number) => this.taskRepo.getTasksByEventDepartment(eventDepartmentId);
  getTask = (id: number) => this.taskRepo.getTask(id);
  getTaskWithEventDepartment = (id: number) => this.taskRepo.getTaskWithEventDepartment(id);
  createTask = (data: Parameters<TaskRepository['createTask']>[0]) => this.taskRepo.createTask(data);
  updateTask = (id: number, data: Parameters<TaskRepository['updateTask']>[1]) => this.taskRepo.updateTask(id, data);
  deleteTask = (id: number) => this.taskRepo.deleteTask(id);
  getTaskComments = (taskId: number) => this.taskRepo.getTaskComments(taskId);
  createTaskComment = (data: Parameters<TaskRepository['createTaskComment']>[0]) => this.taskRepo.createTaskComment(data);
  deleteTaskComment = (id: number) => this.taskRepo.deleteTaskComment(id);
  getTaskCommentAttachments = (commentId: number) => this.taskRepo.getTaskCommentAttachments(commentId);
  getAllTaskCommentAttachments = () => this.taskRepo.getAllTaskCommentAttachments();
  createTaskCommentAttachment = (data: Parameters<TaskRepository['createTaskCommentAttachment']>[0]) => this.taskRepo.createTaskCommentAttachment(data);
  deleteTaskCommentAttachment = (id: number) => this.taskRepo.deleteTaskCommentAttachment(id);
  getStakeholderDashboardData = (departmentId: number) => this.taskRepo.getStakeholderDashboardData(departmentId, this.departmentRepo, this.eventRepo);
  getEventDepartmentsWithPendingTasks = () => this.taskRepo.getEventDepartmentsWithPendingTasks(this.departmentRepo, this.eventRepo);
  getAllTasksForAdminDashboard = () => this.taskRepo.getAllTasksForAdminDashboard(this.departmentRepo, this.eventRepo);
  getPendingTasksByRange = (startDate: Date, endDate: Date, departmentIds?: number[]) => 
    this.taskRepo.getPendingTasksByRange(startDate, endDate, departmentIds);
  getPartnershipTasks = (partnershipId: number) => this.taskRepo.getPartnershipTasks(partnershipId);
  createPartnershipTask = (data: Parameters<TaskRepository['createPartnershipTask']>[0]) => this.taskRepo.createPartnershipTask(data);

  // ==================== Archive Operations ====================
  getAllArchivedEvents = (options?: Parameters<ArchiveRepository['getAllArchivedEvents']>[0]) => this.archiveRepo.getAllArchivedEvents(options);
  getArchivedEvent = (id: number) => this.archiveRepo.getArchivedEvent(id);
  getArchivedEventByOriginalId = (eventId: string) => this.archiveRepo.getArchivedEventByOriginalId(eventId);
  createArchivedEvent = (data: Parameters<ArchiveRepository['createArchivedEvent']>[0]) => this.archiveRepo.createArchivedEvent(data);
  updateArchivedEvent = (id: number, data: Parameters<ArchiveRepository['updateArchivedEvent']>[1]) => this.archiveRepo.updateArchivedEvent(id, data);
  deleteArchivedEvent = (id: number) => this.archiveRepo.deleteArchivedEvent(id);
  getArchivedEventsByYear = (year: number) => this.archiveRepo.getArchivedEventsByYear(year);
  getArchivedEventsByCategory = (categoryId: number) => this.archiveRepo.getArchivedEventsByCategory(categoryId);
  searchArchivedEvents = (query: string) => this.archiveRepo.searchArchivedEvents(query);
  getArchiveStats = () => this.archiveRepo.getArchiveStats();
  getArchiveTimeline = () => this.archiveRepo.getArchiveTimeline();
  getArchiveYears = () => this.archiveRepo.getArchiveYears();
  unarchiveEvent = (archivedEventId: number) => this.archiveRepo.unarchiveEvent(archivedEventId);
  getArchiveMedia = (archivedEventId: number) => this.archiveRepo.getArchiveMedia(archivedEventId);
  createArchiveMedia = (data: Parameters<ArchiveRepository['createArchiveMedia']>[0]) => this.archiveRepo.createArchiveMedia(data);
  updateArchiveMedia = (id: number, data: Parameters<ArchiveRepository['updateArchiveMedia']>[1]) => this.archiveRepo.updateArchiveMedia(id, data);
  deleteArchiveMedia = (id: number) => this.archiveRepo.deleteArchiveMedia(id);
  reorderArchiveMedia = (archivedEventId: number, mediaIds: number[]) => this.archiveRepo.reorderArchiveMedia(archivedEventId, mediaIds);
  getArchivedEventSpeakers = (archivedEventId: number) => this.archiveRepo.getArchivedEventSpeakers(archivedEventId);
  addArchivedEventSpeaker = (data: Parameters<ArchiveRepository['addArchivedEventSpeaker']>[0]) => this.archiveRepo.addArchivedEventSpeaker(data);
  removeArchivedEventSpeaker = (id: number) => this.archiveRepo.removeArchivedEventSpeaker(id);
  
  // Complex archive operation that orchestrates multiple repositories
  archiveEvent = async (eventId: string, archivedByUserId: number, archiveData?: Partial<InsertArchivedEvent>): Promise<ArchivedEvent> => {
    const event = await this.eventRepo.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    const existing = await this.archiveRepo.getArchivedEventByOriginalId(eventId);
    if (existing) throw new Error('Event is already archived');
    
    const eventSpeakersList = await this.contactRepo.getEventSpeakers(eventId);
    const attendees = await this.eventRepo.getEventAttendees(eventId);
    const attendeeCount = attendees.length;
    
    const archivedEvent = await this.archiveRepo.createArchivedEvent({
      name: event.name,
      nameAr: event.nameAr,
      description: event.description,
      descriptionAr: event.descriptionAr,
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      locationAr: event.locationAr,
      organizers: event.organizers,
      organizersAr: event.organizersAr,
      url: event.url,
      category: event.category,
      categoryAr: event.categoryAr,
      categoryId: event.categoryId,
      eventType: event.eventType,
      eventScope: event.eventScope,
      originalEventId: eventId,
      archivedByUserId,
      createdDirectly: false,
      actualAttendees: archiveData?.actualAttendees ?? (attendeeCount > 0 ? attendeeCount : event.expectedAttendance),
      highlights: archiveData?.highlights,
      highlightsAr: archiveData?.highlightsAr,
      impact: archiveData?.impact,
      impactAr: archiveData?.impactAr,
      keyTakeaways: archiveData?.keyTakeaways,
      keyTakeawaysAr: archiveData?.keyTakeawaysAr,
      photoKeys: archiveData?.photoKeys,
      thumbnailKeys: archiveData?.thumbnailKeys,
      youtubeVideoIds: archiveData?.youtubeVideoIds,
    });
    
    for (const speaker of eventSpeakersList) {
      const contact = speaker.contact;
      await this.archiveRepo.addArchivedEventSpeaker({
        archivedEventId: archivedEvent.id,
        contactId: contact.id,
        role: speaker.role ?? undefined,
        roleAr: speaker.roleAr ?? undefined,
        displayOrder: speaker.displayOrder ?? 0,
        speakerNameEn: contact.nameEn ?? undefined,
        speakerNameAr: contact.nameAr ?? undefined,
        speakerTitle: contact.title ?? undefined,
        speakerTitleAr: contact.titleAr ?? undefined,
        speakerPosition: contact.position?.nameEn ?? undefined,
        speakerPositionAr: contact.position?.nameAr ?? undefined,
        speakerOrganization: contact.organization?.nameEn ?? undefined,
        speakerOrganizationAr: contact.organization?.nameAr ?? undefined,
        speakerProfilePictureKey: contact.profilePictureKey ?? undefined,
        speakerProfilePictureThumbnailKey: contact.profilePictureThumbnailKey ?? undefined,
      });
    }
    
    const eventMediaList = await this.mediaRepo.getEventMedia(eventId);
    for (const media of eventMediaList) {
      await this.archiveRepo.createArchiveMedia({
        archivedEventId: archivedEvent.id,
        objectKey: media.objectKey,
        thumbnailKey: media.thumbnailKey ?? undefined,
        originalFileName: media.originalFileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
        caption: media.caption ?? undefined,
        captionAr: media.captionAr ?? undefined,
        displayOrder: media.displayOrder,
        uploadedByUserId: media.uploadedByUserId ?? undefined,
        originalEventMediaId: media.id,
      });
    }
    
    await this.eventRepo.markEventAsArchived(eventId);
    return archivedEvent;
  };

  // ==================== Event Media Operations ====================
  getEventMedia = (eventId: string) => this.mediaRepo.getEventMedia(eventId);
  createEventMedia = (data: Parameters<MediaRepository['createEventMedia']>[0]) => this.mediaRepo.createEventMedia(data);
  updateEventMedia = (id: number, data: Parameters<MediaRepository['updateEventMedia']>[1]) => this.mediaRepo.updateEventMedia(id, data);
  deleteEventMedia = (id: number) => this.mediaRepo.deleteEventMedia(id);
  reorderEventMedia = (eventId: string, mediaIds: number[]) => this.mediaRepo.reorderEventMedia(eventId, mediaIds);

  // ==================== Contact Operations ====================
  getAllOrganizations = () => this.contactRepo.getAllOrganizations();
  getOrganization = (id: number) => this.contactRepo.getOrganization(id);
  createOrganization = (data: Parameters<ContactRepository['createOrganization']>[0]) => this.contactRepo.createOrganization(data);
  updateOrganization = (id: number, data: Parameters<ContactRepository['updateOrganization']>[1]) => this.contactRepo.updateOrganization(id, data);
  deleteOrganization = (id: number) => this.contactRepo.deleteOrganization(id);
  getOrganizationByName = (nameEn: string) => this.contactRepo.getOrganizationByName(nameEn);
  getAllPositions = () => this.contactRepo.getAllPositions();
  getPosition = (id: number) => this.contactRepo.getPosition(id);
  createPosition = (data: Parameters<ContactRepository['createPosition']>[0]) => this.contactRepo.createPosition(data);
  updatePosition = (id: number, data: Parameters<ContactRepository['updatePosition']>[1]) => this.contactRepo.updatePosition(id, data);
  deletePosition = (id: number) => this.contactRepo.deletePosition(id);
  getPositionByName = (nameEn: string) => this.contactRepo.getPositionByName(nameEn);
  getAllCountries = () => this.contactRepo.getAllCountries();
  getCountry = (id: number) => this.contactRepo.getCountry(id);
  getCountryByCode = (code: string) => this.contactRepo.getCountryByCode(code);
  getAllContacts = (options?: Parameters<ContactRepository['getAllContacts']>[0]) => this.contactRepo.getAllContacts(options);
  getContact = (id: number) => this.contactRepo.getContact(id);
  getContactById = (id: number) => this.contactRepo.getContactById(id);
  getOrganizationContactCounts = () => this.contactRepo.getOrganizationContactCounts();
  getEligibleSpeakers = () => this.contactRepo.getEligibleSpeakers();
  createContact = (data: Parameters<ContactRepository['createContact']>[0]) => this.contactRepo.createContact(data);
  updateContact = (id: number, data: Parameters<ContactRepository['updateContact']>[1]) => this.contactRepo.updateContact(id, data);
  deleteContact = (id: number) => this.contactRepo.deleteContact(id);
  getContactByEmail = (email: string) => this.contactRepo.getContactByEmail(email);
  getContactByName = (nameEn: string, organizationId?: number | null) => this.contactRepo.getContactByName(nameEn, organizationId);
  getEventSpeakers = (eventId: string) => this.contactRepo.getEventSpeakers(eventId);
  addEventSpeaker = (data: Parameters<ContactRepository['addEventSpeaker']>[0]) => this.contactRepo.addEventSpeaker(data);
  updateEventSpeaker = (id: number, data: Parameters<ContactRepository['updateEventSpeaker']>[1]) => this.contactRepo.updateEventSpeaker(id, data);
  removeEventSpeaker = (id: number) => this.contactRepo.removeEventSpeaker(id);
  deleteEventSpeakers = (eventId: string) => this.contactRepo.deleteEventSpeakers(eventId);
  getContactEvents = (contactId: number) => this.contactRepo.getContactEvents(contactId);
  getEventAttendees = (eventId: string) => this.contactRepo.getEventAttendees(eventId);
  addEventAttendee = (data: Parameters<ContactRepository['addEventAttendee']>[0]) => this.contactRepo.addEventAttendee(data);
  removeEventAttendee = (eventId: string, contactId: number) => this.contactRepo.removeEventAttendee(eventId, contactId);
  getContactAttendedEvents = (contactId: number) => this.contactRepo.getContactAttendedEvents(contactId);
  getContactsStatistics = (limit: number) => this.contactRepo.getContactsStatistics(limit);
  getGroupedContacts = (options: Parameters<ContactRepository['getGroupedContacts']>[0]) => this.contactRepo.getGroupedContacts(options);
  getOrganizationStatistics = (options: Parameters<ContactRepository['getOrganizationStatistics']>[0]) => this.contactRepo.getOrganizationStatistics(options);
  getEngagementAnalytics = () => this.contactRepo.getEngagementAnalytics();

  // ==================== Invitation Operations ====================
  getEventInvitees = (eventId: string) => this.invitationRepo.getEventInvitees(eventId);
  addEventInvitee = (data: Parameters<InvitationRepository['addEventInvitee']>[0]) => this.invitationRepo.addEventInvitee(data);
  updateEventInvitee = (eventId: string, contactId: number, data: Parameters<InvitationRepository['updateEventInvitee']>[2]) => 
    this.invitationRepo.updateEventInvitee(eventId, contactId, data);
  removeEventInvitee = (eventId: string, contactId: number) => this.invitationRepo.removeEventInvitee(eventId, contactId);
  getContactInvitedEvents = (contactId: number) => this.invitationRepo.getContactInvitedEvents(contactId);
  getEmailTemplate = (type: string, language: string) => this.invitationRepo.getEmailTemplate(type, language);
  getEventCustomEmail = (eventId: string) => this.invitationRepo.getEventCustomEmail(eventId);
  createEventCustomEmail = (data: Parameters<InvitationRepository['createEventCustomEmail']>[0]) => this.invitationRepo.createEventCustomEmail(data);
  updateEventCustomEmail = (id: number, data: Parameters<InvitationRepository['updateEventCustomEmail']>[1]) => this.invitationRepo.updateEventCustomEmail(id, data);
  deleteEventCustomEmail = (id: number) => this.invitationRepo.deleteEventCustomEmail(id);

  // ==================== Workflow Operations ====================
  getTaskTemplatePrerequisites = (taskTemplateId: number) => this.workflowRepo.getTaskTemplatePrerequisites(taskTemplateId);
  getAllPrerequisitesForTemplate = (taskTemplateId: number) => this.workflowRepo.getAllPrerequisitesForTemplate(taskTemplateId);
  getTaskTemplatesWithPrerequisites = (departmentId: number) => 
    this.workflowRepo.getTaskTemplatesWithPrerequisites(departmentId, this.departmentRepo.getDepartmentRequirements.bind(this.departmentRepo));
  createTaskTemplatePrerequisite = (data: Parameters<WorkflowRepository['createTaskTemplatePrerequisite']>[0]) => 
    this.workflowRepo.createTaskTemplatePrerequisite(data);
  deleteTaskTemplatePrerequisite = (taskTemplateId: number, prerequisiteTemplateId: number) => 
    this.workflowRepo.deleteTaskTemplatePrerequisite(taskTemplateId, prerequisiteTemplateId);
  getAvailablePrerequisites = (taskTemplateId: number) => this.workflowRepo.getAvailablePrerequisites(taskTemplateId);
  getEventWorkflows = (eventId: string) => this.workflowRepo.getEventWorkflows(eventId);
  getAllWorkflowsWithDetails = () => this.workflowRepo.getAllWorkflowsWithDetails();
  getWorkflow = (workflowId: number) => this.workflowRepo.getWorkflow(workflowId);
  getWorkflowWithTasks = (workflowId: number) => this.workflowRepo.getWorkflowWithTasks(workflowId);
  createEventWorkflow = (data: Parameters<WorkflowRepository['createEventWorkflow']>[0]) => this.workflowRepo.createEventWorkflow(data);
  deleteEventWorkflow = (workflowId: number) => this.workflowRepo.deleteEventWorkflow(workflowId);
  getWorkflowTasks = (workflowId: number) => this.workflowRepo.getWorkflowTasks(workflowId);
  addTaskToWorkflow = (data: Parameters<WorkflowRepository['addTaskToWorkflow']>[0]) => this.workflowRepo.addTaskToWorkflow(data);
  removeTaskFromWorkflow = (workflowId: number, taskId: number) => this.workflowRepo.removeTaskFromWorkflow(workflowId, taskId);
  getTaskWorkflow = (taskId: number) => this.workflowRepo.getTaskWorkflow(taskId);
  getWaitingTasksForPrerequisite = (prerequisiteTaskId: number) => this.workflowRepo.getWaitingTasksForPrerequisite(prerequisiteTaskId);
  activateWaitingTasks = (prerequisiteTaskId: number) => this.workflowRepo.activateWaitingTasks(prerequisiteTaskId);
  getWorkflowsForDepartment = (departmentId: number) => this.workflowRepo.getWorkflowsForDepartment(departmentId);
  canDepartmentViewWorkflow = (departmentId: number, workflowId: number) => this.workflowRepo.canDepartmentViewWorkflow(departmentId, workflowId);
  isTaskPrerequisiteForOthers = (taskId: number) => this.workflowRepo.isTaskPrerequisiteForOthers(taskId);
  getDependentTasks = (taskId: number) => this.workflowRepo.getDependentTasks(taskId);

  // ==================== Partnership Operations ====================
  getAllPartnershipTypes = () => this.partnershipRepo.getAllPartnershipTypes();
  getPartnershipType = (id: number) => this.partnershipRepo.getPartnershipType(id);
  createPartnershipType = (data: Parameters<PartnershipRepository['createPartnershipType']>[0]) => this.partnershipRepo.createPartnershipType(data);
  updatePartnershipType = (id: number, data: Parameters<PartnershipRepository['updatePartnershipType']>[1]) => this.partnershipRepo.updatePartnershipType(id, data);
  deletePartnershipType = (id: number) => this.partnershipRepo.deletePartnershipType(id);
  getAllAgreementTypes = () => this.partnershipRepo.getAllAgreementTypes();
  getAgreementType = (id: number) => this.partnershipRepo.getAgreementType(id);
  createAgreementType = (data: Parameters<PartnershipRepository['createAgreementType']>[0]) => this.partnershipRepo.createAgreementType(data);
  updateAgreementType = (id: number, data: Parameters<PartnershipRepository['updateAgreementType']>[1]) => this.partnershipRepo.updateAgreementType(id, data);
  deleteAgreementType = (id: number) => this.partnershipRepo.deleteAgreementType(id);
  getAllPartners = (options?: Parameters<PartnershipRepository['getAllPartners']>[0]) => this.partnershipRepo.getAllPartners(options);
  updatePartnership = (id: number, data: Parameters<PartnershipRepository['updatePartnership']>[1]) => this.partnershipRepo.updatePartnership(id, data);
  getPartnerStats = () => this.partnershipRepo.getPartnerStats();
  getPartnershipAgreements = (organizationId: number) => this.partnershipRepo.getPartnershipAgreements(organizationId);
  getPartnershipAgreement = (id: number) => this.partnershipRepo.getPartnershipAgreement(id);
  createPartnershipAgreement = (data: Parameters<PartnershipRepository['createPartnershipAgreement']>[0]) => this.partnershipRepo.createPartnershipAgreement(data);
  updatePartnershipAgreement = (id: number, data: Parameters<PartnershipRepository['updatePartnershipAgreement']>[1]) => this.partnershipRepo.updatePartnershipAgreement(id, data);
  deletePartnershipAgreement = (id: number) => this.partnershipRepo.deletePartnershipAgreement(id);
  getPartnershipActivities = (organizationId: number) => this.partnershipRepo.getPartnershipActivities(organizationId);
  getActivitiesByEventId = (eventId: string) => this.partnershipRepo.getActivitiesByEventId(eventId);
  getPartnershipActivity = (id: number) => this.partnershipRepo.getPartnershipActivity(id);
  createPartnershipActivity = (data: Parameters<PartnershipRepository['createPartnershipActivity']>[0]) => this.partnershipRepo.createPartnershipActivity(data);
  updatePartnershipActivity = (id: number, data: Parameters<PartnershipRepository['updatePartnershipActivity']>[1]) => this.partnershipRepo.updatePartnershipActivity(id, data);
  deletePartnershipActivity = (id: number) => this.partnershipRepo.deletePartnershipActivity(id);
  getPartnerEvents = (organizationId: number) => this.partnershipRepo.getPartnerEvents(organizationId);
  getPartnershipContacts = (organizationId: number) => this.partnershipRepo.getPartnershipContacts(organizationId);
  addPartnershipContact = (data: Parameters<PartnershipRepository['addPartnershipContact']>[0]) => this.partnershipRepo.addPartnershipContact(data);
  updatePartnershipContact = (id: number, data: Parameters<PartnershipRepository['updatePartnershipContact']>[1]) => this.partnershipRepo.updatePartnershipContact(id, data);
  removePartnershipContact = (id: number) => this.partnershipRepo.removePartnershipContact(id);
  getPartnershipComments = (organizationId: number) => this.partnershipRepo.getPartnershipComments(organizationId);
  getPartnershipComment = (id: number) => this.partnershipRepo.getPartnershipComment(id);
  createPartnershipComment = (data: Parameters<PartnershipRepository['createPartnershipComment']>[0]) => this.partnershipRepo.createPartnershipComment(data);
  updatePartnershipComment = (id: number, data: Parameters<PartnershipRepository['updatePartnershipComment']>[1]) => this.partnershipRepo.updatePartnershipComment(id, data);
  deletePartnershipComment = (id: number) => this.partnershipRepo.deletePartnershipComment(id);
  getAgreementAttachments = (agreementId: number) => this.partnershipRepo.getAgreementAttachments(agreementId);
  getAgreementAttachment = (id: number) => this.partnershipRepo.getAgreementAttachment(id);
  getAgreementAttachmentByObjectKey = (objectKey: string) => this.partnershipRepo.getAgreementAttachmentByObjectKey(objectKey);
  createAgreementAttachment = (data: Parameters<PartnershipRepository['createAgreementAttachment']>[0]) => this.partnershipRepo.createAgreementAttachment(data);
  deleteAgreementAttachment = (id: number) => this.partnershipRepo.deleteAgreementAttachment(id);
  getInactivePartnerships = (thresholdDate: Date) => this.partnershipRepo.getInactivePartnerships(thresholdDate);
  updatePartnershipLastActivity = (organizationId: number, activityDate?: Date) => this.partnershipRepo.updatePartnershipLastActivity(organizationId, activityDate);
  updatePartnershipInactivitySettings = (organizationId: number, settings: Parameters<PartnershipRepository['updatePartnershipInactivitySettings']>[1]) => 
    this.partnershipRepo.updatePartnershipInactivitySettings(organizationId, settings);
  markInactivityNotificationSent = (organizationId: number) => this.partnershipRepo.markInactivityNotificationSent(organizationId);
  getPartnershipInteractions = (organizationId: number) => this.partnershipRepo.getPartnershipInteractions(organizationId);
  getPartnershipInteraction = (id: number) => this.partnershipRepo.getPartnershipInteraction(id);
  createPartnershipInteraction = (data: Parameters<PartnershipRepository['createPartnershipInteraction']>[0]) => this.partnershipRepo.createPartnershipInteraction(data);
  updatePartnershipInteraction = (id: number, data: Parameters<PartnershipRepository['updatePartnershipInteraction']>[1]) => this.partnershipRepo.updatePartnershipInteraction(id, data);
  deletePartnershipInteraction = (id: number) => this.partnershipRepo.deletePartnershipInteraction(id);

  // ==================== Lead Operations ====================
  getAllLeads = (options?: Parameters<LeadRepository['getAllLeads']>[0]) => this.leadRepo.getAllLeads(options);
  getLead = (id: number) => this.leadRepo.getLead(id);
  getLeadWithDetails = (id: number) => this.leadRepo.getLeadWithDetails(id);
  createLead = (data: Parameters<LeadRepository['createLead']>[0]) => this.leadRepo.createLead(data);
  updateLead = (id: number, data: Parameters<LeadRepository['updateLead']>[1]) => this.leadRepo.updateLead(id, data);
  deleteLead = (id: number) => this.leadRepo.deleteLead(id);
  getLeadInteractions = (leadId: number) => this.leadRepo.getLeadInteractions(leadId);
  getLeadInteraction = (id: number) => this.leadRepo.getLeadInteraction(id);
  createLeadInteraction = (data: Parameters<LeadRepository['createLeadInteraction']>[0]) => this.leadRepo.createLeadInteraction(data);
  updateLeadInteraction = (id: number, data: Parameters<LeadRepository['updateLeadInteraction']>[1]) => this.leadRepo.updateLeadInteraction(id, data);
  deleteLeadInteraction = (id: number) => this.leadRepo.deleteLeadInteraction(id);
  getContactTasks = (leadId: number) => this.leadRepo.getContactTasks(leadId);
  getContactTask = (id: number) => this.leadRepo.getContactTask(id);
  getContactTaskWithDepartment = (id: number) => this.leadRepo.getContactTaskWithDepartment(id, this.departmentRepo.getDepartment.bind(this.departmentRepo));
  getContactTasksByDepartment = (departmentId: number) => this.leadRepo.getContactTasksByDepartment(departmentId);
  createContactTask = (data: Parameters<LeadRepository['createContactTask']>[0]) => this.leadRepo.createContactTask(data);
  updateContactTask = (id: number, data: Parameters<LeadRepository['updateContactTask']>[1]) => this.leadRepo.updateContactTask(id, data);
  deleteContactTask = (id: number) => this.leadRepo.deleteContactTask(id);
  getContactTasksForDashboard = (departmentId: number) => this.leadRepo.getContactTasksForDashboard(departmentId);
  getContactTaskWithDetails = (id: number) => this.leadRepo.getContactTaskWithDetails(id);
  getContactTaskComments = (contactTaskId: number) => this.leadRepo.getContactTaskComments(contactTaskId);
  createContactTaskComment = (data: Parameters<LeadRepository['createContactTaskComment']>[0]) => this.leadRepo.createContactTaskComment(data);
  deleteContactTaskComment = (id: number) => this.leadRepo.deleteContactTaskComment(id);
  createContactTaskCommentAttachment = (data: Parameters<LeadRepository['createContactTaskCommentAttachment']>[0]) => this.leadRepo.createContactTaskCommentAttachment(data);
  getContactTaskCommentAttachment = (id: number) => this.leadRepo.getContactTaskCommentAttachment(id);
  deleteContactTaskCommentAttachment = (id: number) => this.leadRepo.deleteContactTaskCommentAttachment(id);
  getInteractionAttachments = (interactionId: number, entityType: 'lead' | 'partnership') => this.leadRepo.getInteractionAttachments(interactionId, entityType);
  getInteractionAttachment = (id: number) => this.leadRepo.getInteractionAttachment(id);
  createInteractionAttachment = (data: Parameters<LeadRepository['createInteractionAttachment']>[0]) => this.leadRepo.createInteractionAttachment(data);
  deleteInteractionAttachment = (id: number) => this.leadRepo.deleteInteractionAttachment(id);

  // ==================== AI Chat Operations ====================
  createAiConversation = (userId: number, title?: string) => this.aiChatRepo.createConversation(userId, title);
  getAiConversations = (userId: number) => this.aiChatRepo.getConversations(userId);
  getAiConversation = (id: string, userId: number) => this.aiChatRepo.getConversation(id, userId);
  updateAiConversationTitle = (id: string, userId: number, title: string) => this.aiChatRepo.updateConversationTitle(id, userId, title);
  archiveAiConversation = (id: string, userId: number) => this.aiChatRepo.archiveConversation(id, userId);
  deleteAiConversation = (id: string, userId: number) => this.aiChatRepo.deleteConversation(id, userId);
  addAiChatMessage = (conversationId: string, message: Parameters<AiChatRepository['addMessage']>[1]) => this.aiChatRepo.addMessage(conversationId, message);
  getAiChatMessages = (conversationId: string, userId: number) => this.aiChatRepo.getMessages(conversationId, userId);
  getRecentAiChatMessages = (conversationId: string, limit?: number) => this.aiChatRepo.getRecentMessages(conversationId, limit);
  getOrCreateActiveAiConversation = (userId: number) => this.aiChatRepo.getOrCreateActiveConversation(userId);
}

// Export singleton storage instance
export const storage = new Storage();
