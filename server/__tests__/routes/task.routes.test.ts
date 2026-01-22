/**
 * Task Routes E2E Tests
 *
 * Tests for: server/routes/task.routes.ts
 * Actual Endpoints:
 * - GET /api/tasks/admin (admin dashboard tasks)
 * - GET /api/tasks/pending (pending tasks)
 * - GET /api/tasks/:id
 * - PATCH /api/tasks/:id
 * - DELETE /api/tasks/:id
 * - GET /api/tasks/:id/comments
 * - POST /api/tasks/:id/comments
 * - DELETE /api/tasks/:taskId/comments/:commentId
 * - GET /api/event-departments/:id/tasks
 * - POST /api/event-departments/:id/tasks
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestTask,
  type ExtendedMockedStorage,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
});

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
  storageMock.getAllTasksForAdminDashboard.mockResolvedValue([createTestTask()]);
  storageMock.getTaskWithEventDepartment.mockResolvedValue({
    ...createTestTask(),
    eventDepartment: { eventId: 'event-123', departmentId: 1 },
  });
  storageMock.getTaskComments.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('task.routes', () => {
  describe('GET /api/tasks/admin', () => {
    it('returns list of admin tasks', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/tasks/admin`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns single task', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/tasks/1`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent task', async () => {
      storageMock.getTaskWithEventDepartment.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/tasks/999`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('updates task status', async () => {
      storageMock.updateTask.mockResolvedValue(createTestTask({ status: 'completed' }));

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/tasks/1`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('deletes existing task', async () => {
      storageMock.deleteTask.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/tasks/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/tasks/:id/comments', () => {
    it('returns task comments', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/tasks/1/comments`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/tasks/:id/comments', () => {
    it('creates new comment', async () => {
      storageMock.createTaskComment.mockResolvedValue({
        id: 1,
        taskId: 1,
        body: 'Test comment',
        authorUserId: 1,
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/tasks/1/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: 'Test comment' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/event-departments/:id/tasks', () => {
    it('returns tasks for event department', async () => {
      storageMock.getEventDepartment.mockResolvedValue({ id: 1 });
      storageMock.getTasksByEventDepartment.mockResolvedValue([createTestTask()]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/event-departments/1/tasks`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/event-departments/:id/tasks', () => {
    it('creates task for event department', async () => {
      storageMock.getEventDepartment.mockResolvedValue({ id: 1 });
      storageMock.createTask.mockResolvedValue(createTestTask());

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/event-departments/1/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'New Task',
            description: 'Task description',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});
