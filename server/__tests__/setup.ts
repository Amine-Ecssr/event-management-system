/**
 * Shared test setup for E2E route tests
 * 
 * This file exports utilities, factories, and the mock setup functions
 * that each test file should use.
 */
import express, { type RequestHandler } from 'express';
import type { AddressInfo } from 'net';
import { vi, type Mock } from 'vitest';

import { registerRoutes } from '../routes';

// ============================================================================
// Types
// ============================================================================

export interface MockedStorage {
  sessionStore: {};
  getSettings: Mock;
  createEvent: Mock;
  createEventDepartment: Mock;
  getDepartment: Mock;
  getUsersByDepartmentName: Mock;
  createTask: Mock;
  enqueueReminder: Mock;
  getAllEvents: Mock;
  getEvent: Mock;
  deleteEvent: Mock;
  updateEvent: Mock;
  deleteRemindersForEvent: Mock;
  deleteAllEvents: Mock;
  getCategories: Mock;
  getCategoryById: Mock;
  getCategoryByName: Mock;
  createCategory: Mock;
  updateCategory: Mock;
  deleteCategory: Mock;
  updateSettings: Mock;
  getAllDepartments: Mock;
  createDepartment: Mock;
  updateDepartment: Mock;
  deleteDepartment: Mock;
  getAllUsers: Mock;
  getUserByUsername: Mock;
  getUser: Mock;
  deleteUser: Mock;
  createAuthIdentity: Mock;
  createDepartmentEmail: Mock;
  deleteDepartmentEmail: Mock;
  createDepartmentRequirement: Mock;
  deleteDepartmentRequirement: Mock;
  getAllRemindersWithEvents: Mock;
  getReminder: Mock;
  deleteReminder: Mock;
  getEventDepartment: Mock;
  getTasksByEventDepartment: Mock;
  getTask: Mock;
  getTaskWorkflow: Mock;
  updateTask: Mock;
  deleteTask: Mock;
  getTaskWithEventDepartment: Mock;
  getTaskComments: Mock;
  createTaskComment: Mock;
  getTaskCommentAttachments: Mock;
  getDepartmentAccountByUserId: Mock;
  getStakeholderDashboardData: Mock;
  getLatestUpdate: Mock;
  getAllUpdates: Mock;
  getUpdate: Mock;
  createOrUpdateUpdate: Mock;
  getLatestUpdateForDepartment: Mock;
  getAllUpdatesForDepartment: Mock;
  getUpdateForDepartment: Mock;
  getEventDepartmentsWithDetails: Mock;
  getAllTasksForAdminDashboard: Mock;
  getAllEventDepartmentsForAdmin: Mock;
  getEventDepartmentByEventAndDepartment: Mock;
  // Event speakers and media
  getEventSpeakers: Mock;
  getEventMedia: Mock;
  deleteEventSpeakers: Mock;
  deleteEventDepartments: Mock;
  initializeEventFolders: Mock;
  // Organization routes
  getAllOrganizations: Mock;
  getOrganization: Mock;
  createOrganization: Mock;
  getAllContacts: Mock;
  getAllPositions: Mock;
  getAgreementTypes: Mock;
  getPartnershipTypes: Mock;
  // Archive routes
  getAllArchivedEvents: Mock;
  getArchivedEvent: Mock;
  archiveEvent: Mock;
  unarchiveEvent: Mock;
  getArchiveStatistics: Mock;
  // Partnership routes
  getAllPartners: Mock;
  getPartner: Mock;
  createPartner: Mock;
  getPartnerAgreements: Mock;
  getPartnerActivities: Mock;
  // Lead routes
  getAllLeads: Mock;
  getLead: Mock;
  createLead: Mock;
  getLeadInteractions: Mock;
  getContactTasks: Mock;
  // Invitation routes
  getEventAttendees: Mock;
  getEventInvitees: Mock;
  createEventAttendee: Mock;
  createEventInvitee: Mock;
  // Event files routes
  getEventFolders: Mock;
  getEventFiles: Mock;
  createEventFolder: Mock;
}

export interface MockedEmailService {
  sendStakeholderNotification: Mock;
  sendManagementSummary: Mock;
  sendEventNotification: Mock;
}

export interface MockedWhatsAppService {
  getStatus: Mock;
  sendMessage: Mock;
  getGroups: Mock;
  logout: Mock;
}

// ============================================================================
// Mock Setup Functions
// ============================================================================

export function setupAuthMock() {
  vi.mock('../auth', () => {
    const attachUser: RequestHandler = (req, _res, next) => {
      req.user = { id: 1, role: 'superadmin', username: 'tester' } as any;
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

export function setupStorageMock() {
  vi.mock('../storage', () => ({
    storage: {
      sessionStore: {},
      getSettings: vi.fn(),
      createEvent: vi.fn(),
      createEventDepartment: vi.fn(),
      getDepartment: vi.fn(),
      getUsersByDepartmentName: vi.fn(),
      createTask: vi.fn(),
      enqueueReminder: vi.fn(),
      getAllEvents: vi.fn(),
      getEvent: vi.fn(),
      deleteEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteRemindersForEvent: vi.fn(),
      deleteAllEvents: vi.fn(),
      getCategories: vi.fn(),
      getCategoryById: vi.fn(),
      getCategoryByName: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
      updateSettings: vi.fn(),
      getAllDepartments: vi.fn(),
      createDepartment: vi.fn(),
      updateDepartment: vi.fn(),
      deleteDepartment: vi.fn(),
      getAllUsers: vi.fn(),
      getUserByUsername: vi.fn(),
      getUser: vi.fn(),
      deleteUser: vi.fn(),
      createAuthIdentity: vi.fn(),
      createDepartmentEmail: vi.fn(),
      deleteDepartmentEmail: vi.fn(),
      createDepartmentRequirement: vi.fn(),
      deleteDepartmentRequirement: vi.fn(),
      getAllRemindersWithEvents: vi.fn(),
      getReminder: vi.fn(),
      deleteReminder: vi.fn(),
      getEventDepartment: vi.fn(),
      getTasksByEventDepartment: vi.fn(),
      getTask: vi.fn(),
      getTaskWorkflow: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      getTaskWithEventDepartment: vi.fn(),
      getTaskComments: vi.fn(),
      createTaskComment: vi.fn(),
      getTaskCommentAttachments: vi.fn(),
      getDepartmentAccountByUserId: vi.fn(),
      getStakeholderDashboardData: vi.fn(),
      getLatestUpdate: vi.fn(),
      getAllUpdates: vi.fn(),
      getUpdate: vi.fn(),
      createOrUpdateUpdate: vi.fn(),
      getLatestUpdateForDepartment: vi.fn(),
      getAllUpdatesForDepartment: vi.fn(),
      getUpdateForDepartment: vi.fn(),
      getEventDepartmentsWithDetails: vi.fn(),
      getAllTasksForAdminDashboard: vi.fn(),
      getAllEventDepartmentsForAdmin: vi.fn(),
      getEventDepartmentByEventAndDepartment: vi.fn(),
      // Event speakers and media
      getEventSpeakers: vi.fn(),
      getEventMedia: vi.fn(),
      deleteEventSpeakers: vi.fn(),
      deleteEventDepartments: vi.fn(),
      initializeEventFolders: vi.fn(),
      // Organization routes
      getAllOrganizations: vi.fn(),
      getOrganization: vi.fn(),
      createOrganization: vi.fn(),
      getAllContacts: vi.fn(),
      getAllPositions: vi.fn(),
      getAgreementTypes: vi.fn(),
      getPartnershipTypes: vi.fn(),
      // Archive routes
      getAllArchivedEvents: vi.fn(),
      getArchivedEvent: vi.fn(),
      archiveEvent: vi.fn(),
      unarchiveEvent: vi.fn(),
      getArchiveStatistics: vi.fn(),
      // Partnership routes
      getAllPartners: vi.fn(),
      getPartner: vi.fn(),
      createPartner: vi.fn(),
      getPartnerAgreements: vi.fn(),
      getPartnerActivities: vi.fn(),
      // Lead routes
      getAllLeads: vi.fn(),
      getLead: vi.fn(),
      createLead: vi.fn(),
      getLeadInteractions: vi.fn(),
      getContactTasks: vi.fn(),
      // Invitation routes
      getEventAttendees: vi.fn(),
      getEventInvitees: vi.fn(),
      createEventAttendee: vi.fn(),
      createEventInvitee: vi.fn(),
      // Event files routes
      getEventFolders: vi.fn(),
      getEventFiles: vi.fn(),
      createEventFolder: vi.fn(),
    },
  }));
}

export function setupEmailMock() {
  vi.mock('../email', () => ({
    emailService: {
      sendStakeholderNotification: vi.fn(),
      sendManagementSummary: vi.fn(),
      sendEventNotification: vi.fn(),
    },
  }));
}

export function setupWhatsAppMock() {
  vi.mock('../whatsapp-client', () => ({
    whatsappService: {
      getStatus: vi.fn(),
      sendMessage: vi.fn(),
      getGroups: vi.fn(),
      logout: vi.fn(),
    },
  }));
}

export function setupWhatsAppFormatterMock() {
  vi.mock('../whatsappFormatter', () => ({
    formatEventCreatedMessage: vi.fn().mockResolvedValue({
      message: '🎉 New Event Created!\n\n📅 Test Event',
      language: 'en',
    }),
    formatEventReminderMessage: vi.fn().mockResolvedValue({
      message: '⏰ Event Reminder\n\n📅 Test Event',
      language: 'en',
    }),
    formatTestWhatsAppMessage: vi.fn().mockResolvedValue({
      message: '🔔 Test notification from ECSSR Events Calendar',
      language: 'en',
    }),
    sendEventCreatedNotification: vi.fn().mockResolvedValue(undefined),
    sendEventReminderNotification: vi.fn().mockResolvedValue(undefined),
    sendWhatsAppMessage: vi.fn().mockResolvedValue(undefined),
  }));
}

export function setupDbMock() {
  vi.mock('../db', () => ({
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    },
  }));
}

export function setupAuthServiceMock() {
  vi.mock('../auth-service', () => ({
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
  vi.mock('../services/scraperService', () => ({
    scraperService: {
      scrapeAllSources: vi.fn().mockResolvedValue({
        success: true,
        imported: 10,
        updated: 5,
      }),
      scrapeAbuDhabiEvents: vi.fn().mockResolvedValue({
        success: true,
        imported: 5,
      }),
      scrapeAdnecEvents: vi.fn().mockResolvedValue({
        success: true,
        imported: 3,
      }),
    },
  }));
}

export function setupKeycloakMock() {
  vi.mock('../keycloak-admin', () => ({
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

export function setupWorkflowServiceMock() {
  vi.mock('../services/workflowService', () => ({
    workflowService: {
      canDeleteTask: vi.fn().mockResolvedValue({ canDelete: true }),
      handleTaskCompletion: vi.fn().mockResolvedValue({ activatedTasks: [] }),
    },
  }));
}

/** Call this to setup all mocks at once */
export function setupAllMocks() {
  setupAuthMock();
  setupStorageMock();
  setupEmailMock();
  setupWhatsAppMock();
  setupWhatsAppFormatterMock();
  setupDbMock();
  setupAuthServiceMock();
  setupScraperMock();
  setupKeycloakMock();
  setupWorkflowServiceMock();
}

// ============================================================================
// Server Utilities
// ============================================================================

export async function createServer() {
  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  return server;
}

export async function createRunningServer() {
  const server = await createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

export async function withServer<T>(run: (baseUrl: string) => Promise<T>) {
  const { server, baseUrl } = await createRunningServer();
  try {
    return await run(baseUrl);
  } finally {
    server.close();
  }
}

// ============================================================================
// Default Settings
// ============================================================================

export const baseSettings = {
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

export function createTestEventDepartment(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    eventId: 'event-123',
    departmentId: 1,
    selectedRequirementIds: [],
    customRequirements: null,
    notifyOnCreate: false,
    notifyOnUpdate: false,
    ...overrides,
  };
}

// ============================================================================
// Mock getters - use after dynamic import
// ============================================================================

export async function getMockedModules() {
  const { storage } = await import('../storage');
  const { emailService } = await import('../email');
  const { whatsappService } = await import('../whatsapp-client');
  
  return {
    storageMock: storage as unknown as MockedStorage,
    emailServiceMock: emailService as unknown as MockedEmailService,
    whatsappServiceMock: whatsappService as unknown as MockedWhatsAppService,
  };
}
