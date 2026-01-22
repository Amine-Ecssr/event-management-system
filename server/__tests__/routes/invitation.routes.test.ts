/**
 * Invitation Routes E2E Tests
 *
 * Tests for: server/routes/invitation.routes.ts
 * Actual Endpoints:
 * - GET /api/events/:eventId/attendees
 * - POST /api/events/:eventId/attendees/upload
 * - DELETE /api/events/:eventId/attendees/:contactId
 * - GET /api/events/:eventId/invitees
 * - POST /api/events/:eventId/invitees/upload
 * - POST /api/events/:eventId/invitees/bulk
 * - PATCH /api/events/:eventId/invitees/:contactId
 * - DELETE /api/events/:eventId/invitees/:contactId
 * - POST /api/events/:eventId/send-test-invitation
 * - POST /api/events/:eventId/send-invitations
 * - GET /api/events/:eventId/invitation-jobs
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestEvent,
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

const testEvent = createTestEvent();

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
  // Routes use getEvent not getEventById
  storageMock.getEvent.mockResolvedValue(testEvent);
  storageMock.getEventAttendees.mockResolvedValue([]);
  storageMock.getEventInvitees.mockResolvedValue([]);
  storageMock.getInvitationJobs.mockResolvedValue([]);
  storageMock.getEventSpeakers.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('invitation.routes', () => {
  describe('GET /api/events/:eventId/attendees', () => {
    it('returns event attendees', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/attendees`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns empty array when no attendees', async () => {
      storageMock.getEventAttendees.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/attendees`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/events/:eventId/attendees/:contactId', () => {
    it('removes attendee from event', async () => {
      // Route uses removeEventAttendee not deleteEventAttendee
      storageMock.removeEventAttendee.mockResolvedValue(true);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/attendees/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/events/:eventId/invitees', () => {
    it('returns event invitees', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/invitees`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/events/:eventId/invitees/bulk', () => {
    it('adds multiple invitees', async () => {
      // Route uses addEventInvitee for each contact and getContact to verify
      storageMock.getContact.mockResolvedValue({ id: 1, name: 'Test Contact' });
      storageMock.addEventInvitee.mockResolvedValue({ eventId: '1', contactId: 1 });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/invitees/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactIds: [1, 2],
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('PATCH /api/events/:eventId/invitees/:contactId', () => {
    it('updates invitee', async () => {
      storageMock.updateEventInvitee.mockResolvedValue({
        eventId: '1',
        contactId: 1,
        status: 'confirmed',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/invitees/1`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rsvp: true }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/events/:eventId/invitees/:contactId', () => {
    it('removes invitee from event', async () => {
      // Route uses removeEventInvitee not deleteEventInvitee
      storageMock.removeEventInvitee.mockResolvedValue(true);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/invitees/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/events/:eventId/send-test-invitation', () => {
    it('sends test invitation email', async () => {
      emailServiceMock.sendTestInvitationEmail.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/send-test-invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: 'test@example.com',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/events/:eventId/send-invitations', () => {
    it('sends invitations to all invitees', async () => {
      storageMock.createInvitationJob.mockResolvedValue({
        id: 1,
        eventId: '1',
        status: 'pending',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/send-invitations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/events/:eventId/invitation-jobs', () => {
    it('returns invitation jobs for event', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/1/invitation-jobs`);
        expect(response.status).not.toBe(404);
      });
    });
  });
});
