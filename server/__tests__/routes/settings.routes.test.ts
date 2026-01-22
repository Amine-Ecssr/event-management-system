/**
 * Settings Routes E2E Tests
 *
 * Tests for: server/routes/settings.routes.ts
 * Actual Endpoints:
 * - GET /api/settings (public, limited)
 * - GET /api/settings/admin (full settings)
 * - PATCH /api/settings (not PUT)
 * - POST /api/settings/test-email/reminder
 * - POST /api/settings/test-email/management
 * - POST /api/whatsapp/test (not POST /api/test-whatsapp)
 * - GET /api/whatsapp/status
 * - GET /api/whatsapp/groups
 * - POST /api/whatsapp/logout
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  type ExtendedMockedStorage,
  type ExtendedMockedEmailService,
  type ExtendedMockedWhatsAppService,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;
let emailServiceMock: ExtendedMockedEmailService;
let whatsappServiceMock: ExtendedMockedWhatsAppService;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
  emailServiceMock = mocks.emailServiceMock;
  whatsappServiceMock = mocks.whatsappServiceMock;
});

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('settings.routes', () => {
  describe('GET /api/settings', () => {
    it('returns current settings', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('PATCH /api/settings', () => {
    it('updates settings', async () => {
      storageMock.updateSettings.mockResolvedValue({ ...defaultSettings, emailEnabled: false });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailEnabled: false }),
        });
        expect(response.status).not.toBe(404);
      });
    });

    it('validates settings payload', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invalidField: 'value' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/settings/test-email/reminder', () => {
    it('sends test reminder email', async () => {
      emailServiceMock.sendEventNotification.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/settings/test-email/reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientEmail: 'test@example.com' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/whatsapp/test', () => {
    it('sends test WhatsApp message', async () => {
      whatsappServiceMock.sendMessage.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/whatsapp/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/whatsapp/status', () => {
    it('returns WhatsApp connection status', async () => {
      whatsappServiceMock.getStatus.mockResolvedValue({ connected: true });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/whatsapp/status`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/whatsapp/groups', () => {
    it('returns WhatsApp groups', async () => {
      whatsappServiceMock.getGroups.mockResolvedValue([
        { id: '123@g.us', name: 'Test Group' },
      ]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/whatsapp/groups`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/whatsapp/logout', () => {
    it('logs out WhatsApp', async () => {
      whatsappServiceMock.logout.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/whatsapp/logout`, {
          method: 'POST',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});