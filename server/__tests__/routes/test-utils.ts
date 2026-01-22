/**
 * Route Test Utilities
 *
 * Shared utilities for modular route E2E tests.
 * Provides mock setup, test helpers, and reusable test patterns.
 */
import { vi, type Mock } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import { registerRoutes } from '../../routes';

// ============================================================================
// Extended Mock Storage Interface
// ============================================================================

export interface ExtendedMockedStorage {
  sessionStore: {};
  // Settings
  getSettings: Mock;
  updateSettings: Mock;

  // Events
  getAllEvents: Mock;
  getEvent: Mock;
  getEventById: Mock;
  createEvent: Mock;
  updateEvent: Mock;
  deleteEvent: Mock;
  deleteAllEvents: Mock;
  getEventMedia: Mock;
  createEventMedia: Mock;
  deleteEventMedia: Mock;
  reorderEventMedia: Mock;
  getEventSpeakers: Mock;
  createEventSpeaker: Mock;
  addEventSpeaker: Mock;
  updateEventSpeaker: Mock;
  deleteEventSpeaker: Mock;
  removeEventSpeaker: Mock;
  getEventDepartments: Mock;

  // Categories
  getCategories: Mock;
  getCategoryById: Mock;
  getCategoryByName: Mock;
  createCategory: Mock;
  updateCategory: Mock;
  deleteCategory: Mock;

  // Stakeholders/Departments
  getAllDepartments: Mock;
  getDepartment: Mock;
  createDepartment: Mock;
  updateDepartment: Mock;
  deleteDepartment: Mock;
  getUsersByDepartmentName: Mock;
  getDepartmentAccountByUserId: Mock;

  // Department emails/requirements
  createDepartmentEmail: Mock;
  deleteDepartmentEmail: Mock;
  createDepartmentRequirement: Mock;
  deleteDepartmentRequirement: Mock;

  // Event Departments
  createEventDepartment: Mock;
  getEventDepartment: Mock;
  getEventDepartmentByEventAndDepartment: Mock;
  getEventDepartmentsWithDetails: Mock;
  getAllEventDepartmentsForAdmin: Mock;

  // Tasks
  getAllTasksForAdminDashboard: Mock;
  getTasksByEventDepartment: Mock;
  getTaskWithEventDepartment: Mock;
  createTask: Mock;
  updateTask: Mock;
  deleteTask: Mock;
  getTaskComments: Mock;
  createTaskComment: Mock;
  getTaskCommentAttachments: Mock;

  // Archive
  getAllArchivedEvents: Mock;
  getArchivedEvent: Mock;
  getArchivedEvents: Mock;
  getArchivedEventById: Mock;
  getArchivedEventByOriginalId: Mock;
  archiveEvent: Mock;
  unarchiveEvent: Mock;
  restoreArchivedEvent: Mock;
  deleteArchivedEvent: Mock;
  createArchivedEvent: Mock;
  updateArchivedEvent: Mock;
  getArchiveStatistics: Mock;
  getArchiveStats: Mock;
  getArchiveTimeline: Mock;
  getArchiveYears: Mock;
  getArchivedEventSpeakers: Mock;
  getArchiveMedia: Mock;
  createArchiveMedia: Mock;
  deleteArchiveMedia: Mock;

  // Users
  getAllUsers: Mock;
  getUser: Mock;
  getUserByUsername: Mock;
  deleteUser: Mock;
  createAuthIdentity: Mock;

  // Organizations
  getAllOrganizations: Mock;
  getOrganization: Mock;
  createOrganization: Mock;
  updateOrganization: Mock;
  deleteOrganization: Mock;

  // Contacts
  getAllContacts: Mock;
  getContact: Mock;
  createContact: Mock;
  updateContact: Mock;
  deleteContact: Mock;

  // Positions
  getAllPositions: Mock;
  getPosition: Mock;
  createPosition: Mock;
  updatePosition: Mock;
  deletePosition: Mock;

  // Agreement/Partnership Types
  getAgreementTypes: Mock;
  getAgreementType: Mock;
  createAgreementType: Mock;
  updateAgreementType: Mock;
  deleteAgreementType: Mock;
  getPartnershipTypes: Mock;
  getPartnershipType: Mock;
  createPartnershipType: Mock;
  updatePartnershipType: Mock;
  deletePartnershipType: Mock;

  // Partners
  getAllPartners: Mock;
  getPartner: Mock;
  getPartnerById: Mock;
  getPartnerStats: Mock;
  createPartner: Mock;
  updatePartner: Mock;
  deletePartner: Mock;
  getPartnerAgreements: Mock;
  getPartnerActivities: Mock;
  createPartnerAgreement: Mock;
  createPartnerActivity: Mock;
  getEventPartnerships: Mock;
  createEventPartnership: Mock;
  deleteEventPartnership: Mock;

  // Partnerships
  getAllPartnerships: Mock;
  getPartnershipById: Mock;
  createPartnership: Mock;
  updatePartnership: Mock;
  deletePartnership: Mock;
  getPartnershipAnalytics: Mock;
  getPartnershipStats: Mock;
  getInactivePartnerships: Mock;
  getPartnershipAgreements: Mock;
  createPartnershipAgreement: Mock;
  updatePartnershipAgreement: Mock;
  deletePartnershipAgreement: Mock;

  // Leads
  getAllLeads: Mock;
  getLead: Mock;
  getLeadById: Mock;
  getLeadWithDetails: Mock;
  createLead: Mock;
  updateLead: Mock;
  deleteLead: Mock;
  getLeadInteractions: Mock;
  createLeadInteraction: Mock;
  getLeadActivities: Mock;
  createLeadActivity: Mock;
  convertLeadToPartner: Mock;
  getContactTasks: Mock;
  createContactTask: Mock;
  updateContactTask: Mock;
  deleteContactTask: Mock;
  getContactTaskComments: Mock;
  createContactTaskComment: Mock;
  deleteContactTaskComment: Mock;
  getContactTaskCommentAttachment: Mock;
  createContactTaskCommentAttachment: Mock;

  // Reminders
  getAllRemindersWithEvents: Mock;
  getReminder: Mock;
  enqueueReminder: Mock;
  deleteReminder: Mock;
  deleteRemindersForEvent: Mock;

  // Updates
  getAllUpdates: Mock;
  getUpdate: Mock;
  getLatestUpdate: Mock;
  createOrUpdateUpdate: Mock;
  getLatestUpdateForDepartment: Mock;
  getAllUpdatesForDepartment: Mock;
  getUpdateForDepartment: Mock;

  // Stakeholder Dashboard
  getStakeholderDashboardData: Mock;

  // Attendees/Invitees
  getEventAttendees: Mock;
  getEventAttendee: Mock;
  createEventAttendee: Mock;
  updateEventAttendee: Mock;
  deleteEventAttendee: Mock;
  removeEventAttendee: Mock;
  bulkCreateEventAttendees: Mock;
  getEventInvitees: Mock;
  createEventInvitee: Mock;
  addEventInvitee: Mock;
  updateEventInvitee: Mock;
  deleteEventInvitee: Mock;
  removeEventInvitee: Mock;
  bulkCreateEventInvitees: Mock;
  getInviteeByCode: Mock;
  getInvitationEmailStatus: Mock;

  // Custom Emails
  getEventCustomEmails: Mock;
  createEventCustomEmail: Mock;
  deleteEventCustomEmail: Mock;

  // Invitation Jobs
  getInvitationJobs: Mock;
  getInvitationJob: Mock;
  getInvitationJobsByEventId: Mock;
  createInvitationJob: Mock;
  updateInvitationJob: Mock;
  bulkAddEventInvitees: Mock;

  // Integration/External
  getExternalEvents: Mock;
  importExternalEvent: Mock;
  getEventsForWeeklyUpdate: Mock;
  getContactsWithBirthdayToday: Mock;

  // Event Folders/Files
  getEventFolders: Mock;
  getEventFolder: Mock;
  createEventFolder: Mock;
  deleteEventFolder: Mock;
  getFolder: Mock;
  getFolderById: Mock;
  getFolderContents: Mock;
  getEventFiles: Mock;
  createEventFile: Mock;
  getEventFile: Mock;
  getFileById: Mock;
  deleteEventFile: Mock;
  moveEventFile: Mock;
  copyEventFile: Mock;
  getEventMediaItem: Mock;
  initializeEventFolders: Mock;

  // Folder Templates
  getFolderTemplates: Mock;
  createFolderTemplate: Mock;
  updateFolderTemplate: Mock;
  deleteFolderTemplate: Mock;

  // Access Permissions
  getEventAccess: Mock;
  createEventAccess: Mock;
  deleteEventAccess: Mock;
  getFolderAccess: Mock;
  createFolderAccess: Mock;
  deleteFolderAccess: Mock;
}

export interface ExtendedMockedEmailService {
  sendStakeholderNotification: Mock;
  sendManagementSummary: Mock;
  sendEventNotification: Mock;
  sendInvitationEmail: Mock;
  sendTestInvitationEmail: Mock;
  sendEmail: Mock;
  sendInvitation: Mock;
}

export interface ExtendedMockedWhatsAppService {
  getStatus: Mock;
  sendMessage: Mock;
  getGroups: Mock;
  logout: Mock;
  disconnect: Mock;
}

// ============================================================================
// Mock Setup Functions
// ============================================================================

export function setupExtendedAuthMock() {
  vi.mock('../../auth', () => {
    const attachUser = (req: any, _res: any, next: any) => {
      req.user = { id: 1, role: 'superadmin', username: 'tester' };
      next();
    };

    return {
      setupAuth: (app: express.Express) => {
        app.use(attachUser);
      },
      isAuthenticated: attachUser,
      isSuperAdmin: attachUser,
      isAdminOrSuperAdmin: attachUser,
    };
  });
}

export function setupExtendedStorageMock() {
  vi.mock('../../storage', () => ({
    storage: createMockStorage(),
  }));
}

function createMockStorage(): ExtendedMockedStorage {
  return {
    sessionStore: {},
    // Settings
    getSettings: vi.fn(),
    updateSettings: vi.fn(),

    // Events
    getAllEvents: vi.fn(),
    getEvent: vi.fn(),
    getEventById: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    deleteAllEvents: vi.fn(),
    getEventMedia: vi.fn(),
    createEventMedia: vi.fn(),
    deleteEventMedia: vi.fn(),
    reorderEventMedia: vi.fn(),
    getEventSpeakers: vi.fn(),
    createEventSpeaker: vi.fn(),
    addEventSpeaker: vi.fn(),
    updateEventSpeaker: vi.fn(),
    deleteEventSpeaker: vi.fn(),
    removeEventSpeaker: vi.fn(),
    getEventDepartments: vi.fn(),

    // Categories
    getCategories: vi.fn(),
    getCategoryById: vi.fn(),
    getCategoryByName: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),

    // Stakeholders/Departments
    getAllDepartments: vi.fn(),
    getDepartment: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    deleteDepartment: vi.fn(),
    getUsersByDepartmentName: vi.fn(),
    getDepartmentAccountByUserId: vi.fn(),

    // Department emails/requirements
    createDepartmentEmail: vi.fn(),
    deleteDepartmentEmail: vi.fn(),
    createDepartmentRequirement: vi.fn(),
    deleteDepartmentRequirement: vi.fn(),

    // Event Departments
    createEventDepartment: vi.fn(),
    getEventDepartment: vi.fn(),
    getEventDepartmentByEventAndDepartment: vi.fn(),
    getEventDepartmentsWithDetails: vi.fn(),
    getAllEventDepartmentsForAdmin: vi.fn(),

    // Tasks
    getAllTasksForAdminDashboard: vi.fn(),
    getTasksByEventDepartment: vi.fn(),
    getTaskWithEventDepartment: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getTaskComments: vi.fn(),
    createTaskComment: vi.fn(),
    getTaskCommentAttachments: vi.fn(),

    // Archive
    getAllArchivedEvents: vi.fn(),
    getArchivedEvent: vi.fn(),
    getArchivedEvents: vi.fn(),
    getArchivedEventById: vi.fn(),
    getArchivedEventByOriginalId: vi.fn(),
    archiveEvent: vi.fn(),
    unarchiveEvent: vi.fn(),
    restoreArchivedEvent: vi.fn(),
    deleteArchivedEvent: vi.fn(),
    createArchivedEvent: vi.fn(),
    updateArchivedEvent: vi.fn(),
    getArchiveStatistics: vi.fn(),
    getArchiveStats: vi.fn(),
    getArchiveTimeline: vi.fn(),
    getArchiveYears: vi.fn(),
    getArchivedEventSpeakers: vi.fn(),
    getArchiveMedia: vi.fn(),
    createArchiveMedia: vi.fn(),
    deleteArchiveMedia: vi.fn(),

    // Users
    getAllUsers: vi.fn(),
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    deleteUser: vi.fn(),
    createAuthIdentity: vi.fn(),

    // Organizations
    getAllOrganizations: vi.fn(),
    getOrganization: vi.fn(),
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    deleteOrganization: vi.fn(),

    // Contacts
    getAllContacts: vi.fn(),
    getContact: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),

    // Positions
    getAllPositions: vi.fn(),
    getPosition: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    deletePosition: vi.fn(),

    // Agreement/Partnership Types
    getAgreementTypes: vi.fn(),
    getAgreementType: vi.fn(),
    createAgreementType: vi.fn(),
    updateAgreementType: vi.fn(),
    deleteAgreementType: vi.fn(),
    getPartnershipTypes: vi.fn(),
    getPartnershipType: vi.fn(),
    createPartnershipType: vi.fn(),
    updatePartnershipType: vi.fn(),
    deletePartnershipType: vi.fn(),

    // Partners
    getAllPartners: vi.fn(),
    getPartner: vi.fn(),
    getPartnerById: vi.fn(),
    getPartnerStats: vi.fn(),
    createPartner: vi.fn(),
    updatePartner: vi.fn(),
    deletePartner: vi.fn(),
    getPartnerAgreements: vi.fn(),
    getPartnerActivities: vi.fn(),
    createPartnerAgreement: vi.fn(),
    createPartnerActivity: vi.fn(),
    getEventPartnerships: vi.fn(),
    createEventPartnership: vi.fn(),
    deleteEventPartnership: vi.fn(),

    // Partnerships
    getAllPartnerships: vi.fn(),
    getPartnershipById: vi.fn(),
    createPartnership: vi.fn(),
    updatePartnership: vi.fn(),
    deletePartnership: vi.fn(),
    getPartnershipAnalytics: vi.fn(),
    getPartnershipStats: vi.fn(),
    getInactivePartnerships: vi.fn(),
    getPartnershipAgreements: vi.fn(),
    createPartnershipAgreement: vi.fn(),
    updatePartnershipAgreement: vi.fn(),
    deletePartnershipAgreement: vi.fn(),

    // Leads
    getAllLeads: vi.fn(),
    getLead: vi.fn(),
    getLeadById: vi.fn(),
    getLeadWithDetails: vi.fn(),
    createLead: vi.fn(),
    updateLead: vi.fn(),
    deleteLead: vi.fn(),
    getLeadInteractions: vi.fn(),
    createLeadInteraction: vi.fn(),
    getLeadActivities: vi.fn(),
    createLeadActivity: vi.fn(),
    convertLeadToPartner: vi.fn(),
    getContactTasks: vi.fn(),
    createContactTask: vi.fn(),
    updateContactTask: vi.fn(),
    deleteContactTask: vi.fn(),
    getContactTaskComments: vi.fn(),
    createContactTaskComment: vi.fn(),
    deleteContactTaskComment: vi.fn(),
    getContactTaskCommentAttachment: vi.fn(),
    createContactTaskCommentAttachment: vi.fn(),

    // Reminders
    getAllRemindersWithEvents: vi.fn(),
    getReminder: vi.fn(),
    enqueueReminder: vi.fn(),
    deleteReminder: vi.fn(),
    deleteRemindersForEvent: vi.fn(),

    // Updates
    getAllUpdates: vi.fn(),
    getUpdate: vi.fn(),
    getLatestUpdate: vi.fn(),
    createOrUpdateUpdate: vi.fn(),
    getLatestUpdateForDepartment: vi.fn(),
    getAllUpdatesForDepartment: vi.fn(),
    getUpdateForDepartment: vi.fn(),

    // Stakeholder Dashboard
    getStakeholderDashboardData: vi.fn(),

    // Attendees/Invitees
    getEventAttendees: vi.fn(),
    getEventAttendee: vi.fn(),
    createEventAttendee: vi.fn(),
    updateEventAttendee: vi.fn(),
    deleteEventAttendee: vi.fn(),
    removeEventAttendee: vi.fn(),
    bulkCreateEventAttendees: vi.fn(),
    getEventInvitees: vi.fn(),
    createEventInvitee: vi.fn(),
    addEventInvitee: vi.fn(),
    updateEventInvitee: vi.fn(),
    deleteEventInvitee: vi.fn(),
    removeEventInvitee: vi.fn(),
    bulkCreateEventInvitees: vi.fn(),
    getInviteeByCode: vi.fn(),
    getInvitationEmailStatus: vi.fn(),

    // Custom Emails
    getEventCustomEmails: vi.fn(),
    createEventCustomEmail: vi.fn(),
    deleteEventCustomEmail: vi.fn(),

    // Invitation Jobs
    getInvitationJobs: vi.fn(),
    getInvitationJob: vi.fn(),
    getInvitationJobsByEventId: vi.fn(),
    createInvitationJob: vi.fn(),
    updateInvitationJob: vi.fn(),
    bulkAddEventInvitees: vi.fn(),

    // Integration/External
    getExternalEvents: vi.fn(),
    importExternalEvent: vi.fn(),
    getEventsForWeeklyUpdate: vi.fn(),
    getContactsWithBirthdayToday: vi.fn(),

    // Event Folders/Files
    getEventFolders: vi.fn(),
    getEventFolder: vi.fn(),
    createEventFolder: vi.fn(),
    deleteEventFolder: vi.fn(),
    getFolder: vi.fn(),
    getFolderById: vi.fn(),
    getFolderContents: vi.fn(),
    getEventFiles: vi.fn(),
    createEventFile: vi.fn(),
    getEventFile: vi.fn(),
    getFileById: vi.fn(),
    deleteEventFile: vi.fn(),
    moveEventFile: vi.fn(),
    copyEventFile: vi.fn(),
    getEventMediaItem: vi.fn(),
    initializeEventFolders: vi.fn(),

    // Folder Templates
    getFolderTemplates: vi.fn(),
    createFolderTemplate: vi.fn(),
    updateFolderTemplate: vi.fn(),
    deleteFolderTemplate: vi.fn(),

    // Access Permissions
    getEventAccess: vi.fn(),
    createEventAccess: vi.fn(),
    deleteEventAccess: vi.fn(),
    getFolderAccess: vi.fn(),
    createFolderAccess: vi.fn(),
    deleteFolderAccess: vi.fn(),
  };
}

export function setupExtendedEmailMock() {
  vi.mock('../../email', () => ({
    emailService: {
      sendStakeholderNotification: vi.fn(),
      sendManagementSummary: vi.fn(),
      sendEventNotification: vi.fn(),
      sendInvitationEmail: vi.fn(),
      sendTestInvitationEmail: vi.fn(),
      sendEmail: vi.fn().mockResolvedValue({ success: true }),
      sendInvitation: vi.fn().mockResolvedValue({ success: true }),
    },
  }));
}

export function setupExtendedWhatsAppMock() {
  vi.mock('../../whatsapp-client', () => ({
    whatsappService: {
      getStatus: vi.fn().mockResolvedValue({ connected: true }),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      getGroups: vi.fn().mockResolvedValue([]),
      logout: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
  }));
}

export function setupWhatsAppFormatterMock() {
  vi.mock('../../whatsappFormatter', () => ({
    formatEventCreatedMessage: vi.fn().mockResolvedValue({
      message: '🎉 New Event Created!',
      language: 'en',
    }),
    formatEventReminderMessage: vi.fn().mockResolvedValue({
      message: '⏰ Event Reminder',
      language: 'en',
    }),
    formatTestWhatsAppMessage: vi.fn().mockResolvedValue({
      message: '🔔 Test notification',
      language: 'en',
    }),
    sendEventCreatedNotification: vi.fn().mockResolvedValue(undefined),
    sendEventReminderNotification: vi.fn().mockResolvedValue(undefined),
    sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
  }));
}

export function setupDbMock() {
  vi.mock('../../db', () => ({
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    },
  }));
}

export function setupAuthServiceMock() {
  vi.mock('../../auth-service', () => ({
    getAuthService: vi.fn(() => ({
      createUser: vi.fn().mockResolvedValue({
        id: 3,
        username: 'newadmin',
        role: 'admin',
        password: 'hashed',
      }),
      updateUserPassword: vi.fn().mockResolvedValue(undefined),
    })),
  }));
}

export function setupScraperMock() {
  vi.mock('../../services/scraperService', () => ({
    scraperService: {
      scrapeAllSources: vi.fn().mockResolvedValue({ success: true, imported: 10 }),
      scrapeAbuDhabiEvents: vi.fn().mockResolvedValue({ success: true, imported: 5 }),
      scrapeAdnecEvents: vi.fn().mockResolvedValue({ success: true, imported: 3 }),
    },
  }));
}

export function setupKeycloakMock() {
  vi.mock('../../keycloak-admin', () => ({
    keycloakAdmin: {
      isConfigured: vi.fn().mockReturnValue(true),
      getAllGroups: vi.fn().mockResolvedValue([
        { path: '/IT', name: 'IT' },
        { path: '/Operations', name: 'Operations' },
      ]),
      syncGroupsToDepartments: vi.fn().mockResolvedValue(undefined),
      syncAllGroupsAndMembers: vi.fn().mockResolvedValue(undefined),
      syncGroupMembersToUsers: vi.fn().mockResolvedValue(undefined),
    },
  }));
}

export function setupMinioMock() {
  vi.mock('../../services/minio', () => ({
    minioService: {
      // File operations
      uploadFile: vi.fn().mockResolvedValue({ objectKey: 'test-key' }),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      getSignedUrl: vi.fn().mockResolvedValue('https://minio.example.com/signed-url'),
      listFiles: vi.fn().mockResolvedValue([]),
      
      // Image operations
      uploadImage: vi.fn().mockResolvedValue({ objectKey: 'test-key', thumbnailKey: 'test-thumb-key' }),
      deleteImage: vi.fn().mockResolvedValue(undefined),
      generateSignedMediaUrl: vi.fn().mockReturnValue('https://minio.example.com/signed-media-url'),
      
      // Agreement attachments
      getAgreementMaxFileSize: vi.fn().mockReturnValue(10 * 1024 * 1024), // 10MB
      getAgreementAllowedMimeTypes: vi.fn().mockReturnValue(['application/pdf', 'image/jpeg', 'image/png']),
      uploadAgreementAttachment: vi.fn().mockResolvedValue({ objectKey: 'agreement-key' }),
      deleteAgreementAttachment: vi.fn().mockResolvedValue(undefined),
      generateSignedAgreementAttachmentUrl: vi.fn().mockReturnValue('https://minio.example.com/signed-agreement-url'),
      verifySignedAgreementAttachmentUrl: vi.fn().mockReturnValue(true),
      getAgreementAttachmentBuffer: vi.fn().mockResolvedValue({ buffer: Buffer.from('test'), contentType: 'application/pdf' }),
      
      // Lead interaction attachments
      getInteractionMaxFileSize: vi.fn().mockReturnValue(10 * 1024 * 1024), // 10MB
      getInteractionAllowedMimeTypes: vi.fn().mockReturnValue(['application/pdf', 'image/jpeg', 'image/png']),
      uploadInteractionAttachment: vi.fn().mockResolvedValue({ objectKey: 'interaction-key' }),
      generateSignedInteractionAttachmentUrl: vi.fn().mockReturnValue('https://minio.example.com/signed-interaction-url'),
      
      // Event files
      getEventFileBuffer: vi.fn().mockResolvedValue(Buffer.from('test')),
      getEventFileMetadata: vi.fn().mockResolvedValue({ contentType: 'application/pdf', size: 1024 }),
      verifySignedEventFileUrl: vi.fn().mockReturnValue(true),
      
      // MinIO availability
      isMinioAvailable: vi.fn().mockResolvedValue(true),
      getMinioConfig: vi.fn().mockReturnValue({ endpoint: 'localhost:9000', bucket: 'test' }),
    },
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  }));
}

export function setupEventFileServiceMock() {
  vi.mock('../../services/eventFileService', () => ({
    eventFileService: {
      initializeEventFolders: vi.fn().mockResolvedValue([]),
      getEventFolders: vi.fn().mockResolvedValue([]),
      getFolder: vi.fn().mockResolvedValue({ id: 1, name: 'Test Folder' }),
      listFolderContents: vi.fn().mockResolvedValue({ folders: [], files: [] }),
      createFolder: vi.fn().mockResolvedValue({ id: 1 }),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
      uploadFile: vi.fn().mockResolvedValue({ id: 1 }),
      getFile: vi.fn().mockResolvedValue({ id: 1, name: 'test.pdf' }),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      moveFile: vi.fn().mockResolvedValue({ id: 1 }),
      copyFile: vi.fn().mockResolvedValue({ id: 2 }),
    },
  }));
}

export function setupFolderPermissionMock() {
  vi.mock('../../services/folderPermissionService', () => ({
    folderPermissionService: {
      checkEventAccess: vi.fn().mockResolvedValue(true),
      checkFolderAccess: vi.fn().mockResolvedValue(true),
      getUserFolderPermission: vi.fn().mockResolvedValue('manage'),
      isAdmin: vi.fn().mockResolvedValue(true),
    },
  }));
}

export function setupWorkflowServiceMock() {
  vi.mock('../../services/workflowService', () => ({
    workflowService: {
      createWorkflowForEventDepartment: vi.fn().mockResolvedValue(undefined),
      createWorkflowsForEvent: vi.fn().mockResolvedValue(undefined),
      getWorkflowForEventDepartment: vi.fn().mockResolvedValue(null),
    },
  }));
}

/** Setup all mocks at once */
export function setupAllExtendedMocks() {
  setupExtendedAuthMock();
  setupExtendedStorageMock();
  setupExtendedEmailMock();
  setupExtendedWhatsAppMock();
  setupWhatsAppFormatterMock();
  setupDbMock();
  setupAuthServiceMock();
  setupScraperMock();
  setupKeycloakMock();
  setupMinioMock();
  setupEventFileServiceMock();
  setupFolderPermissionMock();
  setupWorkflowServiceMock();
}

// ============================================================================
// Server Utilities
// ============================================================================

export async function createTestServer() {
  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  return server;
}

export async function createRunningTestServer() {
  const server = await createTestServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

export async function withTestServer<T>(run: (baseUrl: string) => Promise<T>) {
  const { server, baseUrl } = await createRunningTestServer();
  try {
    return await run(baseUrl);
  } finally {
    server.close();
  }
}

// ============================================================================
// Default Settings
// ============================================================================

export const defaultSettings = {
  emailEnabled: true,
  emailFromEmail: 'no-reply@example.com',
  emailFromName: 'ECSSR Events',
  managementSummaryEnabled: true,
  managementSummaryRecipients: 'manager@example.com',
  reminderCcList: '',
  globalCcList: '',
  whatsappEnabled: true,
  whatsappChatId: '',
  whatsappChatName: 'Ops',
  archiveEnabled: true,
  scrapedEventsEnabled: true,
  publicCsvExport: false,
  fileUploadsEnabled: true,
  dailyReminderGlobalEnabled: false,
  dailyReminderGlobalTime: null,
  allowStakeholderAttendeeUpload: false,
  stakeholderUploadPermissions: {},
};

// ============================================================================
// Test Data Factories
// ============================================================================

export function createTestEvent(overrides: Record<string, any> = {}) {
  return {
    id: 'event-123',
    name: 'Test Event',
    nameAr: 'حدث تجريبي',
    startDate: '2025-06-01',
    endDate: '2025-06-01',
    description: 'Test description',
    location: 'Test Location',
    category: 'general',
    isScraped: false,
    reminder1Week: false,
    reminder1Day: false,
    reminderWeekly: false,
    reminderDaily: false,
    reminderMorningOf: false,
    ...overrides,
  };
}

export function createTestDepartment(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    name: 'Operations',
    nameAr: 'التشغيل',
    active: true,
    emails: [{ id: 1, departmentId: 1, email: 'ops@example.com', label: 'Primary', primary: true }],
    requirements: [{ id: 10, departmentId: 1, title: 'Signage', description: 'Prepare signs' }],
    ...overrides,
  };
}

export function createTestUser(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    username: 'testuser',
    role: 'admin',
    password: 'hashed',
    ...overrides,
  };
}

export function createTestTask(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    eventDepartmentId: 1,
    title: 'Test Task',
    description: 'Task description',
    status: 'pending',
    ...overrides,
  };
}

export function createTestCategory(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    nameEn: 'Conference',
    nameAr: 'مؤتمر',
    ...overrides,
  };
}

export function createTestOrganization(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    name: 'Test Organization',
    nameAr: 'منظمة اختبارية',
    type: 'corporate',
    ...overrides,
  };
}

export function createTestContact(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+971501234567',
    organizationId: 1,
    ...overrides,
  };
}

export function createTestPartner(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    organizationId: 1,
    name: 'Test Partner',
    type: 'strategic',
    status: 'active',
    ...overrides,
  };
}

export function createTestLead(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    organizationId: 1,
    name: 'Test Lead',
    status: 'new',
    priority: 'medium',
    ...overrides,
  };
}

export function createTestArchivedEvent(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    originalEventId: 'event-123',
    name: 'Archived Event',
    nameAr: 'حدث مؤرشف',
    startDate: '2024-06-01',
    endDate: '2024-06-01',
    archivedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestStakeholder(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    name: 'Test Stakeholder',
    departmentId: 1,
    email: 'stakeholder@example.com',
    phone: '+1234567890',
    ...overrides,
  };
}

// ============================================================================
// Mock Module Getters
// ============================================================================

/**
 * Get mocked modules - call this inside beforeAll or beforeEach
 */
export async function getExtendedMockedModules() {
  const { storage } = await import('../../storage');
  const { emailService } = await import('../../email');
  const { whatsappService } = await import('../../whatsapp-client');

  return {
    storageMock: storage as unknown as ExtendedMockedStorage,
    emailServiceMock: emailService as unknown as ExtendedMockedEmailService,
    whatsappServiceMock: whatsappService as unknown as ExtendedMockedWhatsAppService,
  };
}

// Module-level cache for synchronous access after initialization
let _storageMock: ExtendedMockedStorage | null = null;
let _emailServiceMock: ExtendedMockedEmailService | null = null;
let _whatsappServiceMock: ExtendedMockedWhatsAppService | null = null;

/**
 * Initialize mocks - call this in beforeAll
 */
export async function initMocks() {
  const mocks = await getExtendedMockedModules();
  _storageMock = mocks.storageMock;
  _emailServiceMock = mocks.emailServiceMock;
  _whatsappServiceMock = mocks.whatsappServiceMock;
  return mocks;
}

/**
 * Get storage mock synchronously (must call initMocks first in beforeAll)
 */
export function getStorageMock(): ExtendedMockedStorage {
  if (!_storageMock) {
    throw new Error('Mocks not initialized. Call initMocks() in beforeAll first.');
  }
  return _storageMock;
}

/**
 * Get email service mock synchronously (must call initMocks first in beforeAll)
 */
export function getEmailServiceMock(): ExtendedMockedEmailService {
  if (!_emailServiceMock) {
    throw new Error('Mocks not initialized. Call initMocks() in beforeAll first.');
  }
  return _emailServiceMock;
}

/**
 * Get WhatsApp service mock synchronously (must call initMocks first in beforeAll)
 */
export function getWhatsAppServiceMock(): ExtendedMockedWhatsAppService {
  if (!_whatsappServiceMock) {
    throw new Error('Mocks not initialized. Call initMocks() in beforeAll first.');
  }
  return _whatsappServiceMock;
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to test that a route exists (does not return 404)
 */
export async function testRouteExists(
  baseUrl: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: object
) {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, options);
  return response;
}

/**
 * Helper to assert a route returns success (2xx) or expected status
 */
export function expectRouteSuccess(response: Response, expectedStatuses: number[] = [200, 201, 204]) {
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`Expected ${expectedStatuses.join(' or ')}, got ${response.status}`);
  }
}

/**
 * Helper to assert a route does not return 404
 */
export function expectRouteRegistered(response: Response) {
  if (response.status === 404) {
    throw new Error(`Route returned 404 - not registered`);
  }
}
