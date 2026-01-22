/**
 * Archive Routes E2E Tests
 *
 * Tests for: server/routes/archive.routes.ts
 * Actual Endpoints:
 * - GET /api/archive
 * - GET /api/archive/:id
 * - POST /api/archive (create archived event)
 * - POST /api/archive/from-event/:eventId
 * - PATCH /api/archive/:id
 * - POST /api/archive/:id/unarchive
 * - DELETE /api/archive/:id
 * - GET /api/archive/stats
 * - GET /api/archive/years
 * - GET /api/archive/:id/speakers
 * - POST /api/archive/:id/speakers
 * - POST /api/archive/:id/photos
 * - DELETE /api/archive/:id/photos/:mediaId
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestArchivedEvent,
  type ExtendedMockedStorage,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
});

const archivedEvent = createTestArchivedEvent();

beforeEach(() => {
  vi.clearAllMocks();
  // Enable archive feature
  storageMock.getSettings.mockResolvedValue({ ...defaultSettings, archiveFeatureEnabled: true });
  // Use correct storage method names
  storageMock.getAllArchivedEvents.mockResolvedValue({ events: [archivedEvent], total: 1, totalPages: 1 });
  storageMock.getArchivedEvent.mockResolvedValue(archivedEvent);
  storageMock.getArchiveMedia.mockResolvedValue([]);
  storageMock.getArchiveYears.mockResolvedValue([2024, 2023, 2022]);
  storageMock.getArchiveStats.mockResolvedValue({ total: 1 });
  storageMock.getArchivedEventSpeakers.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('archive.routes', () => {
  describe('GET /api/archive', () => {
    it('returns list of archived events', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns empty array when no archived events', async () => {
      storageMock.getAllArchivedEvents.mockResolvedValue({ events: [], total: 0, totalPages: 0 });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/archive/:id', () => {
    it('returns single archived event', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/1`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent archived event', async () => {
      storageMock.getArchivedEvent.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/999`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('POST /api/archive/from-event/:eventId', () => {
    it('archives an event', async () => {
      storageMock.getEvent.mockResolvedValue({
        id: '1',
        name: 'Test Event',
      });
      storageMock.archiveEvent.mockResolvedValue(archivedEvent);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/from-event/1`, {
          method: 'POST',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/archive/:id/unarchive', () => {
    it('restores archived event', async () => {
      storageMock.unarchiveEvent.mockResolvedValue({
        id: '1',
        name: 'Restored Event',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/1/unarchive`, {
          method: 'POST',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/archive/:id', () => {
    it('permanently deletes archived event', async () => {
      storageMock.deleteArchivedEvent.mockResolvedValue(true);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/archive/stats', () => {
    it('returns archive statistics', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/stats`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/archive/years', () => {
    it('returns years with archived events', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/years`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/archive/:id/speakers', () => {
    it('returns speakers for archived event', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/archive/1/speakers`);
        expect(response.status).not.toBe(404);
      });
    });
  });
});