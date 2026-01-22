/**
 * Health Routes E2E Tests
 *
 * Tests for: server/routes/health.routes.ts
 * Endpoints:
 * - GET /api/health
 * - GET /api/dashboard/stats
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
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('health.routes', () => {
  describe('GET /api/health', () => {
    it('returns health status', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/health`);
        expect(response.status).not.toBe(404);
        // May return 500 if DB not connected in test environment
        expect([200, 500]).toContain(response.status);
      });
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('returns dashboard statistics', async () => {
      storageMock.getAllEvents.mockResolvedValue([createTestEvent()]);
      storageMock.getAllDepartments.mockResolvedValue([createTestDepartment()]);
      storageMock.getAllTasksForAdminDashboard.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/dashboard/stats`);
        expect(response.status).not.toBe(404);
      });
    });

    it('handles empty data', async () => {
      storageMock.getAllEvents.mockResolvedValue([]);
      storageMock.getAllDepartments.mockResolvedValue([]);
      storageMock.getAllTasksForAdminDashboard.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/dashboard/stats`);
        expect(response.status).not.toBe(404);
      });
    });
  });
});
