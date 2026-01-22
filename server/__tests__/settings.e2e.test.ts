/**
 * E2E tests for Settings endpoints
 * 
 * Tests: GET /api/settings, GET /api/settings/admin, PATCH /api/settings
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
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

describe('GET /api/health', () => {
  it('returns ok status for health check', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });
});

describe('GET /api/settings', () => {
  it('returns only public settings', async () => {
    storageMock.getSettings.mockResolvedValueOnce({
      ...baseSettings,
      publicCsvExport: true,
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/settings`);
      const settings = await response.json();

      expect(response.status).toBe(200);
      expect(settings).toHaveProperty('publicCsvExport');
      expect(settings).not.toHaveProperty('emailFromEmail');
    });
  });
});

describe('GET /api/settings/admin', () => {
  it('returns all settings for superadmin', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/settings/admin`);
      const settings = await response.json();

      expect(response.status).toBe(200);
      expect(settings).toHaveProperty('emailEnabled');
      expect(settings).toHaveProperty('managementSummaryEnabled');
    });
  });
});

describe('PATCH /api/settings', () => {
  it('updates settings', async () => {
    storageMock.updateSettings.mockResolvedValueOnce({
      ...baseSettings,
      emailEnabled: false,
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          emailEnabled: false,
        }),
      });

      expect(response.status).toBe(200);
      expect(storageMock.updateSettings).toHaveBeenCalled();
    });
  });
});
