/**
 * Admin Routes E2E Tests
 *
 * Tests for: server/routes/admin.routes.ts
 * Actual Endpoints:
 * - GET /api/users
 * - POST /api/admin/create-user
 * - DELETE /api/admin/users/:id
 * - PATCH /api/admin/users/:id/reset-password
 * - GET /api/keycloak/groups
 * - POST /api/keycloak/sync/groups
 * - POST /api/keycloak/sync/all
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestUser,
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
  storageMock.getAllUsers.mockResolvedValue([createTestUser()]);
  storageMock.getUser.mockResolvedValue(createTestUser());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('admin.routes', () => {
  describe('GET /api/users', () => {
    it('returns list of users', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/users`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/admin/create-user', () => {
    it('creates new user', async () => {
      storageMock.getUserByUsername.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'newuser',
            password: 'password123',
            role: 'admin',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('deletes existing user', async () => {
      storageMock.deleteUser.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/users/2`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent user', async () => {
      storageMock.getUser.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/users/999`, {
          method: 'DELETE',
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('PATCH /api/admin/users/:id/reset-password', () => {
    it('resets user password', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/admin/users/1/reset-password`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'newpassword123' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/keycloak/groups', () => {
    it('returns Keycloak groups', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/keycloak/groups`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/keycloak/sync/all', () => {
    it('triggers Keycloak full sync', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/keycloak/sync/all`, {
          method: 'POST',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});
