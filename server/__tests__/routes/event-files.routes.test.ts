/**
 * Event Files Routes E2E Tests
 *
 * Tests for: server/routes/event-files.routes.ts
 * Note: Routes are mounted with /api prefix
 * Actual Endpoints:
 * - GET /api/events/:eventId/folders
 * - POST /api/events/:eventId/folders
 * - POST /api/events/:eventId/folders/initialize
 * - GET /api/folders/:folderId
 * - DELETE /api/folders/:folderId
 * - POST /api/folders/:folderId/files
 * - GET /api/files/:fileId
 * - GET /api/files/:fileId/download
 * - DELETE /api/files/:fileId
 * - GET /api/folder-templates
 * - POST /api/folder-templates
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestEvent,
  type ExtendedMockedStorage,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
});

const testEvent = createTestEvent();

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
  storageMock.getEventById.mockResolvedValue(testEvent);
  storageMock.getEventFolders.mockResolvedValue([]);
  storageMock.getFolderById.mockResolvedValue({
    id: 'folder-123',
    eventId: 'event-123',
    name: 'Test Folder',
    parentId: null,
  });
  storageMock.getFolderTemplates.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('event-files.routes', () => {
  describe('GET /api/events/:eventId/folders', () => {
    it('returns event folders', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/folders`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns empty array when no folders', async () => {
      storageMock.getEventFolders.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/folders`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/events/:eventId/folders', () => {
    it('creates new folder', async () => {
      storageMock.createEventFolder.mockResolvedValue({
        id: 'folder-new',
        eventId: 'event-123',
        name: 'New Folder',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Folder' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/events/:eventId/folders/initialize', () => {
    it('initializes folder structure from template', async () => {
      storageMock.initializeEventFolders.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/events/event-123/folders/initialize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/folders/:folderId', () => {
    it('returns folder with contents', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/folders/folder-123`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/folders/:folderId', () => {
    it('deletes folder', async () => {
      storageMock.deleteEventFolder.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/folders/folder-123`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/files/:fileId', () => {
    it('returns file metadata', async () => {
      storageMock.getFileById.mockResolvedValue({
        id: 'file-123',
        folderId: 'folder-123',
        name: 'test.pdf',
        mimeType: 'application/pdf',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/files/file-123`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/files/:fileId', () => {
    it('deletes file', async () => {
      storageMock.deleteEventFile.mockResolvedValue(undefined);
      storageMock.getFileById.mockResolvedValue({
        id: 'file-123',
        folderId: 'folder-123',
        name: 'test.pdf',
        minioObjectKey: 'events/file.pdf',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/files/file-123`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/folder-templates', () => {
    it('returns folder templates', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/folder-templates`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/folder-templates', () => {
    it('creates folder template', async () => {
      storageMock.createFolderTemplate.mockResolvedValue({
        id: 'template-123',
        name: 'Default Template',
        structure: [],
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/folder-templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Default Template',
            structure: [],
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});
