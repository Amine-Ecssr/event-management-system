/**
 * E2E tests for Event endpoints
 * 
 * Tests: POST /api/events, GET /api/events, GET /api/events/:id, 
 *        PATCH /api/events/:id, DELETE /api/events/:id, DELETE /api/events
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  createTestEvent,
  createTestDepartment,
  getMockedModules,
  type MockedStorage,
  type MockedEmailService,
} from './setup';

// Setup all mocks before dynamic imports
setupAllMocks();

// Import mocked modules
const { storageMock, emailServiceMock } = await getMockedModules();

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();

  // Setup default mock implementations
  storageMock.getSettings.mockResolvedValue(baseSettings);
  storageMock.createEvent.mockImplementation(async (data: any) => ({
    id: 'event-123',
    ...data,
  }));
  storageMock.createEventDepartment.mockResolvedValue({
    id: 55,
    eventId: 'event-123',
    departmentId: 1,
    selectedRequirementIds: [10],
    customRequirements: 'Bring signage',
    notifyOnCreate: true,
    notifyOnUpdate: false,
  });
  storageMock.getDepartment.mockResolvedValue(createTestDepartment());
  storageMock.getUsersByDepartmentName.mockResolvedValue([]);
  storageMock.createTask.mockResolvedValue({ id: 700, eventDepartmentId: 55, title: 'Signage' });
  storageMock.enqueueReminder.mockResolvedValue({ id: 900 });
  storageMock.getAllEvents.mockResolvedValue([]);
  storageMock.getEvent.mockResolvedValue(undefined);
  storageMock.getEventMedia.mockResolvedValue([]);
  storageMock.getEventSpeakers.mockResolvedValue([]);
  storageMock.deleteEventSpeakers.mockResolvedValue(undefined);
  storageMock.deleteEventDepartments.mockResolvedValue(undefined);
  storageMock.initializeEventFolders.mockResolvedValue(undefined);

  emailServiceMock.sendStakeholderNotification.mockResolvedValue(undefined);
  emailServiceMock.sendManagementSummary.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/events', () => {
  it('creates event and queues reminders with stakeholder and management notifications', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Annual Planning',
          startDate: '2025-01-15',
          endDate: '2025-01-15',
          category: 'general',
          reminder1Week: true,
          reminder1Day: true,
          reminderWeekly: true,
          reminderDaily: true,
          reminderMorningOf: true,
          stakeholders: [
            {
              departmentId: 1,
              selectedRequirementIds: [10],
              customRequirements: 'Branding delivered',
              notifyOnCreate: true,
            },
          ],
        }),
      });

      expect(response.status).toBe(201);
    });
    
    expect(emailServiceMock.sendStakeholderNotification).toHaveBeenCalledTimes(1);
    expect(emailServiceMock.sendManagementSummary).toHaveBeenCalledTimes(1);
    expect(storageMock.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        eventDepartmentId: 55,
        title: 'Custom Requirements',
        description: 'Branding delivered',
      })
    );
    expect(storageMock.enqueueReminder).toHaveBeenCalledTimes(9);
    
    const reminderTypes = storageMock.enqueueReminder.mock.calls.map((call: any) => call[0].reminderType);
    expect(reminderTypes).toEqual(
      expect.arrayContaining(['1_week', '1_day', 'weekly', 'daily', 'morning_of'])
    );
  });

  it('skips email dispatch when email is disabled but still enqueues reminders', async () => {
    storageMock.getSettings.mockResolvedValue({
      ...baseSettings,
      emailEnabled: false,
      managementSummaryEnabled: false,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Offline Dry Run',
          startDate: '2025-01-15',
          endDate: '2025-01-15',
          category: 'general',
          reminder1Week: true,
          reminder1Day: true,
          reminderWeekly: false,
          reminderDaily: false,
          reminderMorningOf: true,
        }),
      });

      expect(response.status).toBe(201);
    });
    
    expect(emailServiceMock.sendStakeholderNotification).not.toHaveBeenCalled();
    expect(emailServiceMock.sendManagementSummary).not.toHaveBeenCalled();
    expect(storageMock.enqueueReminder).toHaveBeenCalled();
  });
});

describe('GET /api/events', () => {
  it('returns all events when scraped events are enabled', async () => {
    storageMock.getSettings.mockResolvedValueOnce({
      ...baseSettings,
      scrapedEventsEnabled: true,
    });
    storageMock.getAllEvents.mockResolvedValueOnce([
      createTestEvent({ id: '1', name: 'Event 1', isScraped: false }),
      createTestEvent({ id: '2', name: 'Event 2', isScraped: true }),
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events`);
      const events = await response.json();

      expect(response.status).toBe(200);
      expect(events).toHaveLength(2);
    });
  });

  it('filters out scraped events when disabled in settings', async () => {
    storageMock.getSettings.mockResolvedValueOnce({
      ...baseSettings,
      scrapedEventsEnabled: false,
    });
    storageMock.getAllEvents.mockResolvedValueOnce([
      createTestEvent({ id: '1', name: 'Event 1', isScraped: false }),
      createTestEvent({ id: '2', name: 'Event 2', isScraped: true }),
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events`);
      const events = await response.json();

      expect(response.status).toBe(200);
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('1');
    });
  });
});

describe('GET /api/events/:id', () => {
  it('returns event details when event exists', async () => {
    storageMock.getEvent.mockResolvedValueOnce(
      createTestEvent({ id: 'event-123', name: 'Conference' })
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/event-123`);
      const event = await response.json();

      expect(response.status).toBe(200);
      expect(event.id).toBe('event-123');
    });
  });

  it('returns 404 when event does not exist', async () => {
    storageMock.getEvent.mockResolvedValueOnce(undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/nonexistent`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toMatch(/not found/i);
    });
  });
});

describe('PATCH /api/events/:id', () => {
  it('updates event and reschedules reminders', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    
    storageMock.getEvent.mockResolvedValueOnce(
      createTestEvent({
        id: 'event-456',
        name: 'Old Name',
        reminder1Week: false,
        reminder1Day: false,
      })
    );
    storageMock.updateEvent.mockResolvedValueOnce(
      createTestEvent({
        id: 'event-456',
        name: 'Updated Name',
        reminder1Week: true,
        reminder1Day: true,
      })
    );
    storageMock.deleteRemindersForEvent.mockResolvedValue(undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/event-456`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Updated Name',
          reminder1Week: true,
          reminder1Day: true,
        }),
      });

      expect(response.status).toBe(200);
      expect(storageMock.updateEvent).toHaveBeenCalledWith('event-456', expect.any(Object));
      expect(storageMock.deleteRemindersForEvent).toHaveBeenCalledWith('event-456');
      expect(storageMock.enqueueReminder).toHaveBeenCalled();
    });
    
    vi.useRealTimers();
  });
});

describe('DELETE /api/events/:id', () => {
  it('deletes an existing event', async () => {
    storageMock.deleteEvent.mockResolvedValueOnce(true);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/event-789`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);
      expect(storageMock.deleteEvent).toHaveBeenCalledWith('event-789');
    });
  });

  it('returns 404 when event does not exist', async () => {
    storageMock.deleteEvent.mockResolvedValueOnce(false);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/nonexistent`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
    });
  });
});

describe('DELETE /api/events', () => {
  it('deletes all events (superadmin only)', async () => {
    storageMock.deleteAllEvents.mockResolvedValueOnce(undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);
      expect(storageMock.deleteAllEvents).toHaveBeenCalled();
    });
  });
});
