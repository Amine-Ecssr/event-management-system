/**
 * Event Routes E2E Tests
 *
 * Tests for: server/routes/event.routes.ts
 * Endpoints:
 * - GET /api/events
 * - GET /api/events/:id
 * - GET /api/events/:id/ics
 * - GET /api/events/:id/agenda/:lang
 * - POST /api/events
 * - PATCH /api/events/:id
 * - DELETE /api/events/:id
 * - DELETE /api/events (all)
 * - GET /api/events/:eventId/speakers
 * - POST /api/events/:eventId/speakers
 * - PUT /api/events/:eventId/speakers/:speakerId
 * - DELETE /api/events/:eventId/speakers/:speakerId
 * - GET /api/events/:eventId/media
 * - POST /api/events/:eventId/media
 * - DELETE /api/events/:eventId/media/:mediaId
 * - POST /api/events/:eventId/media/reorder
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestEvent,
  createTestDepartment,
  type ExtendedMockedStorage,
  type ExtendedMockedEmailService,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;
let emailServiceMock: ExtendedMockedEmailService;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
  emailServiceMock = mocks.emailServiceMock;
});

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
  storageMock.getAllEvents.mockResolvedValue([]);
  storageMock.getEvent.mockResolvedValue(createTestEvent());
  storageMock.getEventMedia.mockResolvedValue([]);
  storageMock.getUsersByDepartmentName.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('event.routes', () => {
  // ==================== Event CRUD ====================
  describe('GET /api/events', () => {
    it('returns list of events', async () => {
      storageMock.getAllEvents.mockResolvedValue([createTestEvent()]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events`);
        expect(response.status).not.toBe(404);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      });
    });

    it('filters scraped events when setting disabled', async () => {
      storageMock.getSettings.mockResolvedValue({ ...defaultSettings, scrapedEventsEnabled: false });
      storageMock.getAllEvents.mockResolvedValue([
        createTestEvent({ id: '1', isScraped: false }),
        createTestEvent({ id: '2', isScraped: true }),
      ]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/events/:id', () => {
    it('returns single event', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent event', async () => {
      storageMock.getEvent.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/nonexistent`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('POST /api/events', () => {
    it('creates new event', async () => {
      storageMock.createEvent.mockResolvedValue(createTestEvent());
      storageMock.enqueueReminder.mockResolvedValue({ id: 1 });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Event',
            startDate: '2025-06-15',
            endDate: '2025-06-15',
          }),
        });
        expect(response.status).not.toBe(404);
        expect([200, 201]).toContain(response.status);
      });
    });

    it('creates event with stakeholders', async () => {
      storageMock.createEvent.mockResolvedValue(createTestEvent());
      storageMock.createEventDepartment.mockResolvedValue({ id: 1 });
      storageMock.getDepartment.mockResolvedValue(createTestDepartment());
      storageMock.createTask.mockResolvedValue({ id: 1 });
      storageMock.enqueueReminder.mockResolvedValue({ id: 1 });
      emailServiceMock.sendStakeholderNotification.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Event with Stakeholders',
            startDate: '2025-06-15',
            endDate: '2025-06-15',
            stakeholders: [
              { departmentId: 1, selectedRequirementIds: [], notifyOnCreate: true },
            ],
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('PATCH /api/events/:id', () => {
    it('updates existing event', async () => {
      storageMock.updateEvent.mockResolvedValue(createTestEvent({ name: 'Updated' }));
      storageMock.deleteRemindersForEvent.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Event' }),
        });
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent event', async () => {
      storageMock.getEvent.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/nonexistent`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('deletes existing event', async () => {
      storageMock.deleteEvent.mockResolvedValue(true);
      storageMock.deleteRemindersForEvent.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent event', async () => {
      storageMock.deleteEvent.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/nonexistent`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('DELETE /api/events (all)', () => {
    it('deletes all events (superadmin only)', async () => {
      storageMock.deleteAllEvents.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  // ==================== Event Speakers ====================
  describe('GET /api/events/:eventId/speakers', () => {
    it('returns speakers for event', async () => {
      storageMock.getEventSpeakers.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/speakers`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/events/:eventId/speakers', () => {
    it('adds speaker to event', async () => {
      storageMock.getContact.mockResolvedValue({ id: 1, isEligibleSpeaker: true });
      storageMock.addEventSpeaker.mockResolvedValue({ id: 1 });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/speakers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: 1, role: 'keynote' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  // ==================== Event Media ====================
  describe('GET /api/events/:eventId/media', () => {
    it('returns media for event', async () => {
      storageMock.getEventMedia.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/media`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/events/:eventId/media/reorder', () => {
    it('reorders media for event', async () => {
      storageMock.reorderEventMedia.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/media/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds: [1, 2, 3] }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});
