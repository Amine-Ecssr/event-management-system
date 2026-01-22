/**
 * E2E tests for WhatsApp endpoints
 * 
 * Tests: GET /api/whatsapp/status, GET /api/whatsapp/groups, 
 *        POST /api/whatsapp/test, POST /api/whatsapp/logout, GET /api/whatsapp/chats
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
const { storageMock, whatsappServiceMock } = await getMockedModules();

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();

  storageMock.getSettings.mockResolvedValue(baseSettings);
  whatsappServiceMock.getStatus.mockResolvedValue({ connected: true });
  whatsappServiceMock.sendMessage.mockResolvedValue({ success: true, message: 'ok' });
  whatsappServiceMock.getGroups.mockResolvedValue({ groups: [] });
  whatsappServiceMock.logout.mockResolvedValue({ success: true, message: 'ok' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/whatsapp/test', () => {
  it('fails fast when the WhatsApp session is not connected', async () => {
    whatsappServiceMock.getStatus.mockResolvedValueOnce({ connected: false });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/whatsapp/test`, { method: 'POST' });
      expect(response.status).toBe(400);
    });
    expect(whatsappServiceMock.sendMessage).not.toHaveBeenCalled();
  });

  it('blocks sending when no chat target is configured', async () => {
    whatsappServiceMock.getStatus.mockResolvedValueOnce({ connected: true });
    storageMock.getSettings.mockResolvedValueOnce({
      ...baseSettings,
      whatsappChatId: '',
      whatsappChatName: '',
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/whatsapp/test`, { method: 'POST' });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toMatch(/No WhatsApp group selected/i);
    });
    expect(whatsappServiceMock.sendMessage).not.toHaveBeenCalled();
  });

  it('sends a test notification when connected and configured', async () => {
    whatsappServiceMock.getStatus.mockResolvedValueOnce({ connected: true });
    storageMock.getSettings.mockResolvedValueOnce({
      ...baseSettings,
      whatsappChatName: 'Comms Room',
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/whatsapp/test`, { method: 'POST' });

      expect(response.status).toBe(200);
      expect(whatsappServiceMock.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ groupName: 'Comms Room' })
      );
    });
  });
});

describe('GET /api/whatsapp/status', () => {
  it('returns connection status', async () => {
    whatsappServiceMock.getStatus.mockResolvedValueOnce({
      connected: true,
      phoneNumber: '+1234567890',
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/whatsapp/status`);
      const status = await response.json();

      expect(response.status).toBe(200);
      expect(status.connected).toBe(true);
      expect(status.phoneNumber).toBe('+1234567890');
    });
  });
});

describe('GET /api/whatsapp/groups', () => {
  it('returns available groups', async () => {
    whatsappServiceMock.getGroups.mockResolvedValueOnce({
      groups: [
        { name: 'Operations Team', id: 'group-1' },
        { name: 'Management', id: 'group-2' },
      ],
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/whatsapp/groups`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.groups).toHaveLength(2);
    });
  });
});

describe('POST /api/whatsapp/logout', () => {
  it('logs out from WhatsApp', async () => {
    whatsappServiceMock.logout.mockResolvedValueOnce({
      success: true,
      message: 'Logged out',
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/whatsapp/logout`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      expect(whatsappServiceMock.logout).toHaveBeenCalled();
    });
  });
});

describe('GET /api/whatsapp/chats', () => {
  it('returns available chats', async () => {
    whatsappServiceMock.getGroups.mockResolvedValueOnce({
      groups: [
        { name: 'Team Chat', id: 'chat-1' },
      ],
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/whatsapp/chats`);
      const chats = await response.json();

      expect(response.status).toBe(200);
      expect(chats).toHaveLength(1);
      expect(chats[0].name).toBe('Team Chat');
    });
  });
});
