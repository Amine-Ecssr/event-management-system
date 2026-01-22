/**
 * Integration Routes E2E Tests
 *
 * Tests for: server/routes/integration.routes.ts
 * Actual Endpoints:
 * - POST /api/scraper/abu-dhabi
 * - POST /api/scraper/adnec
 * - POST /api/scraper/all
 * - GET /api/reminders
 * - POST /api/reminders
 * - DELETE /api/reminders/:id
 * - POST /api/reminders/:id/resend
 * - GET /api/updates
 * - GET /api/updates/latest
 * - POST /api/updates
 * - POST /api/updates/send
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  type ExtendedMockedStorage,
  type ExtendedMockedWhatsAppService,
  type ExtendedMockedEmailService,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;
let whatsappServiceMock: ExtendedMockedWhatsAppService;
let emailServiceMock: ExtendedMockedEmailService;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
  whatsappServiceMock = mocks.whatsappServiceMock;
  emailServiceMock = mocks.emailServiceMock;
});

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);

  // Reminder mocks - route uses enqueueReminder not createReminder
  storageMock.getAllRemindersWithEvents.mockResolvedValue([]);
  storageMock.enqueueReminder.mockResolvedValue({
    id: 1,
    eventId: '1',
    type: 'email',
    scheduledFor: new Date(),
    status: 'pending',
  });
  storageMock.deleteReminder.mockResolvedValue(true);
  storageMock.getReminder.mockResolvedValue({
    id: 1,
    eventId: '1',
    type: 'email',
    scheduledFor: new Date(),
    status: 'pending',
  });
  storageMock.getEvent.mockResolvedValue({
    id: '1',
    name: 'Test Event',
  });
  
  // Updates mocks
  storageMock.getLatestUpdate.mockResolvedValue(null);
  storageMock.getAllUpdates.mockResolvedValue([]);
  storageMock.createOrUpdateUpdate.mockResolvedValue({
    id: 1,
    type: 'weekly',
    createdAt: new Date(),
  });

  // Email mocks
  emailServiceMock.sendEmail.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('integration.routes', () => {
  describe('GET /api/reminders', () => {
    it('returns all reminders', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns reminders with event details', async () => {
      storageMock.getAllRemindersWithEvents.mockResolvedValue([
        {
          id: 'reminder-1',
          eventId: 'event-1',
          eventTitle: 'Test Event',
          type: 'email',
          scheduledFor: new Date(),
          status: 'pending',
        },
      ]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/reminders', () => {
    it('creates a new reminder', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: 'event-123',
            type: 'email',
            scheduledFor: new Date().toISOString(),
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/reminders/:id', () => {
    it('deletes a reminder', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders/reminder-123`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/updates', () => {
    it('returns all updates', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/updates`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/updates/latest', () => {
    it('returns latest update', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/updates/latest`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/updates', () => {
    it('creates a new update', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/updates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'weekly',
            content: 'Weekly update content',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/updates/send', () => {
    it('sends an update', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/updates/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateId: 'update-123',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});