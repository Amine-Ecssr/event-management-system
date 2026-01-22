/**
 * E2E tests for Task management endpoints
 * 
 * Tests: Tasks CRUD, Task comments, Admin task dashboard
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  createTestTask,
  createTestEventDepartment,
  getMockedModules,
} from './setup';

// Setup all mocks
setupAllMocks();

// Import mocked modules
const { storageMock } = await getMockedModules();

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(baseSettings);

  // Default task-related mocks
  storageMock.getEventDepartment.mockResolvedValue(createTestEventDepartment());
  storageMock.getTasksByEventDepartment.mockResolvedValue([
    createTestTask({ id: 1, title: 'Task 1', status: 'pending' }),
    createTestTask({ id: 2, title: 'Task 2', status: 'completed' }),
  ]);
  storageMock.getTask.mockResolvedValue(
    createTestTask({ id: 1, title: 'Task 1', status: 'pending' })
  );
  storageMock.getTaskWorkflow.mockResolvedValue(null);
  storageMock.updateTask.mockResolvedValue(
    createTestTask({ id: 1, title: 'Task 1', status: 'completed' })
  );
  storageMock.deleteTask.mockResolvedValue(true);
  storageMock.getTaskWithEventDepartment.mockResolvedValue({
    id: 1,
    eventDepartment: createTestEventDepartment(),
  });
  storageMock.createTask.mockResolvedValue(createTestTask({ id: 3, title: 'New Task' }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/event-departments/:id/tasks', () => {
  it('returns tasks for event department', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/event-departments/1/tasks`);
      const tasks = await response.json();

      expect(response.status).toBe(200);
      expect(tasks).toHaveLength(2);
    });
  });
});

describe('POST /api/event-departments/:id/tasks', () => {
  it('creates a task', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/event-departments/1/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'New Task',
          description: 'Task description',
          status: 'pending',
        }),
      });

      expect(response.status).toBe(201);
      expect(storageMock.createTask).toHaveBeenCalled();
    });
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates a task', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tasks/1`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
        }),
      });

      expect(response.status).toBe(200);
      expect(storageMock.updateTask).toHaveBeenCalled();
    });
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tasks/1`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      expect(storageMock.deleteTask).toHaveBeenCalled();
    });
  });
});

describe('Task comments', () => {
  beforeEach(() => {
    storageMock.getTaskComments.mockResolvedValue([
      { id: 1, taskId: 1, body: 'Comment 1', authorUsername: 'user1' },
      { id: 2, taskId: 1, body: 'Comment 2', authorUsername: 'user2' },
    ]);
    storageMock.createTaskComment.mockResolvedValue({
      id: 3,
      taskId: 1,
      body: 'New comment',
      authorUserId: 1,
    });
    storageMock.getTaskCommentAttachments.mockResolvedValue([]);
  });

  it('GET /api/tasks/:id/comments returns task comments', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tasks/1/comments`);
      const comments = await response.json();

      expect(response.status).toBe(200);
      expect(comments).toHaveLength(2);
    });
  });

  it('POST /api/tasks/:id/comments creates a comment', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tasks/1/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body: 'New comment',
        }),
      });

      expect(response.status).toBe(201);
      expect(storageMock.createTaskComment).toHaveBeenCalled();
    });
  });
});

describe('Admin task endpoints', () => {
  it('GET /api/admin/tasks returns all tasks for admin dashboard', async () => {
    storageMock.getAllTasksForAdminDashboard.mockResolvedValueOnce([
      {
        id: 1,
        title: 'Task 1',
        eventName: 'Event 1',
        departmentName: 'Operations',
      },
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/tasks`);
      const tasks = await response.json();

      expect(response.status).toBe(200);
      expect(tasks).toHaveLength(1);
    });
  });

  it('GET /api/admin/event-stakeholders returns all event-stakeholder pairs', async () => {
    storageMock.getAllEventDepartmentsForAdmin.mockResolvedValueOnce([
      {
        id: 1,
        eventId: 'event-1',
        eventName: 'Event 1',
        departmentId: 1,
        departmentName: 'Operations',
      },
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/event-stakeholders`);
      const pairs = await response.json();

      expect(response.status).toBe(200);
      expect(pairs).toHaveLength(1);
    });
  });
});
