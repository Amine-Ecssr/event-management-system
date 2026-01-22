/**
 * E2E tests for User management endpoints
 * 
 * Tests: GET /api/users, POST /api/admin/create-user, DELETE /api/admin/users/:id
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  createTestUser,
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/users', () => {
  it('returns all users without passwords', async () => {
    storageMock.getAllUsers.mockResolvedValueOnce([
      createTestUser({ id: 1, username: 'admin', role: 'admin' }),
      createTestUser({ id: 2, username: 'user', role: 'department' }),
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/users`);
      const users = await response.json();

      expect(response.status).toBe(200);
      expect(users).toHaveLength(2);
      expect(users[0]).not.toHaveProperty('password');
    });
  });
});

describe('POST /api/admin/create-user', () => {
  it('creates a new admin user', async () => {
    storageMock.getUserByUsername.mockResolvedValueOnce(undefined);
    storageMock.createAuthIdentity.mockResolvedValueOnce({ id: 1 });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/create-user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: 'newadmin',
          password: 'password123',
          role: 'admin',
        }),
      });

      expect(response.status).toBe(201);
    });
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('deletes a user', async () => {
    storageMock.getUser.mockResolvedValueOnce(
      createTestUser({ id: 2, username: 'user', role: 'admin' })
    );
    storageMock.getAllUsers.mockResolvedValueOnce([
      createTestUser({ id: 1, role: 'superadmin' }),
      createTestUser({ id: 2, role: 'admin' }),
    ]);
    storageMock.deleteUser.mockResolvedValueOnce(true);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/users/2`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      expect(storageMock.deleteUser).toHaveBeenCalledWith(2);
    });
  });
});
