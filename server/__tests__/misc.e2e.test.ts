/**
 * E2E tests for other endpoints
 * 
 * Tests: Reminders, Email tests, Scraper, Keycloak sync, Updates, Dashboard
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  createTestEvent,
  getMockedModules,
} from './setup';

// Setup all mocks
setupAllMocks();

// Import mocked modules
const { storageMock, emailServiceMock } = await getMockedModules();

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(baseSettings);
  emailServiceMock.sendStakeholderNotification.mockResolvedValue(undefined);
  emailServiceMock.sendManagementSummary.mockResolvedValue(undefined);
  emailServiceMock.sendEventNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// Email Test Endpoints
// =============================================================================

describe('Email test endpoints', () => {
  describe('POST /api/settings/test-email/stakeholder', () => {
    it('sends test stakeholder email', async () => {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings/test-email/stakeholder`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: 'test@example.com',
          }),
        });

        expect(response.status).toBe(200);
        expect(emailServiceMock.sendStakeholderNotification).toHaveBeenCalled();
      });
    });

    it('returns 400 if email not enabled', async () => {
      storageMock.getSettings.mockResolvedValueOnce({
        ...baseSettings,
        emailEnabled: false,
      });

      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings/test-email/stakeholder`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: 'test@example.com',
          }),
        });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('POST /api/settings/test-email/reminder', () => {
    it('sends test reminder email', async () => {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings/test-email/reminder`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: 'test@example.com',
          }),
        });

        expect(response.status).toBe(200);
        expect(emailServiceMock.sendEventNotification).toHaveBeenCalled();
      });
    });
  });

  describe('POST /api/settings/test-email/management', () => {
    it('sends test management summary email', async () => {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings/test-email/management`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: 'manager@example.com',
          }),
        });

        expect(response.status).toBe(200);
        expect(emailServiceMock.sendManagementSummary).toHaveBeenCalled();
      });
    });
  });
});

// =============================================================================
// Reminder Endpoints
// =============================================================================

describe('Reminder endpoints', () => {
  describe('GET /api/reminders', () => {
    it('returns all reminders', async () => {
      storageMock.getAllRemindersWithEvents.mockResolvedValueOnce([
        { id: 1, eventId: 'event-1', reminderType: '1_week', status: 'pending' },
        { id: 2, eventId: 'event-2', reminderType: '1_day', status: 'sent' },
      ]);

      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders`);
        const reminders = await response.json();

        expect(response.status).toBe(200);
        expect(reminders).toHaveLength(2);
      });
    });
  });

  describe('POST /api/reminders', () => {
    it('creates a new reminder', async () => {
      storageMock.getEvent.mockResolvedValueOnce(
        createTestEvent({ id: 'event-1', startDate: '2025-06-01' })
      );
      storageMock.enqueueReminder.mockResolvedValue({ id: 100 });

      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            eventId: 'event-1',
            reminderType: 'weekly',
          }),
        });

        expect(response.status).toBe(201);
        expect(storageMock.enqueueReminder).toHaveBeenCalled();
      });
    });
  });

  describe('DELETE /api/reminders/:id', () => {
    it('deletes a pending reminder', async () => {
      storageMock.getReminder.mockResolvedValueOnce({
        id: 1,
        status: 'pending',
      });
      storageMock.deleteReminder.mockResolvedValueOnce(true);

      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders/1`, {
          method: 'DELETE',
        });

        expect(response.status).toBe(200);
        expect(storageMock.deleteReminder).toHaveBeenCalledWith(1);
      });
    });

    it('prevents deleting sent reminders', async () => {
      storageMock.getReminder.mockResolvedValueOnce({
        id: 1,
        status: 'sent',
      });

      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/reminders/1`, {
          method: 'DELETE',
        });

        expect(response.status).toBe(400);
      });
    });
  });
});

// =============================================================================
// Scraper Endpoints
// =============================================================================

describe('Scraper endpoints', () => {
  it('POST /api/scraper/all triggers scraping', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/scraper/all`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
    });
  });

  it('POST /api/scraper/abu-dhabi triggers Abu Dhabi scraping', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/scraper/abu-dhabi`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
    });
  });

  it('POST /api/scraper/adnec triggers ADNEC scraping', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/scraper/adnec`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
    });
  });
});

// =============================================================================
// Keycloak Sync Endpoints
// =============================================================================

describe('Keycloak sync endpoints', () => {
  it('GET /api/keycloak/groups returns all groups', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/keycloak/groups`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.groups).toBeDefined();
    });
  });

  it('POST /api/keycloak/sync/groups syncs groups', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/keycloak/sync/groups`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
    });
  });

  it('POST /api/keycloak/sync/all syncs all groups and members', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/keycloak/sync/all`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
    });
  });
});

// =============================================================================
// Updates Endpoints
// =============================================================================

describe('Updates endpoints', () => {
  beforeEach(() => {
    storageMock.getLatestUpdate.mockResolvedValue({
      id: 1,
      type: 'weekly',
      content: 'Latest update',
    });
    storageMock.getAllUpdates.mockResolvedValue([
      { id: 1, type: 'weekly', content: 'Update 1' },
      { id: 2, type: 'weekly', content: 'Update 2' },
    ]);
    storageMock.getUpdate.mockResolvedValue({
      id: 1,
      type: 'weekly',
      periodStart: '2025-01-01',
      content: 'Specific update',
    });
    storageMock.createOrUpdateUpdate.mockResolvedValue({
      id: 1,
      type: 'weekly',
      content: 'New update',
    });
    storageMock.getLatestUpdateForDepartment.mockResolvedValue(null);
    storageMock.getAllUpdatesForDepartment.mockResolvedValue([]);
    storageMock.getUpdateForDepartment.mockResolvedValue(null);
    storageMock.getDepartmentAccountByUserId.mockResolvedValue(null);
  });

  it('GET /api/updates/latest returns latest update', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/updates/latest?type=weekly`);
      const update = await response.json();

      expect(response.status).toBe(200);
      expect(storageMock.getLatestUpdate).toHaveBeenCalledWith('weekly');
    });
  });

  it('GET /api/updates returns all updates of type', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/updates?type=weekly`);
      const updates = await response.json();

      expect(response.status).toBe(200);
      expect(updates).toHaveLength(2);
    });
  });

  it('GET /api/updates/:type/:periodStart returns specific update', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/updates/weekly/2025-01-01`);
      const update = await response.json();

      expect(response.status).toBe(200);
      expect(update).toHaveProperty('content');
    });
  });

  it('POST /api/updates creates or updates an update', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/updates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'weekly',
          periodStart: '2025-01-01',
          content: 'New update content',
        }),
      });

      expect(response.status).toBe(200);
      expect(storageMock.createOrUpdateUpdate).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Stakeholder Dashboard
// =============================================================================
// Note: Stakeholder dashboard endpoint was removed during routes refactoring.
// TODO: Re-implement /api/stakeholder-dashboard endpoint with proper tests.
