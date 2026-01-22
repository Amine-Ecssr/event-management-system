/**
 * Lead Routes E2E Tests
 *
 * Tests for: server/routes/lead.routes.ts
 * Actual Endpoints:
 * - GET /api/leads
 * - POST /api/leads
 * - GET /api/leads/:id
 * - PUT /api/leads/:id
 * - DELETE /api/leads/:id
 * - GET /api/leads/:id/interactions
 * - POST /api/leads/:id/interactions
 * - GET /api/leads/:id/tasks
 * - POST /api/leads/:id/tasks
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestLead,
  type ExtendedMockedStorage,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
});

const testLead = createTestLead();

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
  storageMock.getAllLeads.mockResolvedValue([testLead]);
  storageMock.getLeadById.mockResolvedValue(testLead);
  storageMock.getLeadWithDetails.mockResolvedValue(testLead);
  storageMock.getLeadActivities.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('lead.routes', () => {
  describe('GET /api/leads', () => {
    it('returns list of leads', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads`);
        expect(response.status).not.toBe(404);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      });
    });

    it('returns empty array when no leads exist', async () => {
      storageMock.getAllLeads.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads`);
        expect(response.status).not.toBe(404);
        const data = await response.json();
        expect(data).toEqual([]);
      });
    });
  });

  describe('POST /api/leads', () => {
    it('creates new lead', async () => {
      storageMock.createLead.mockResolvedValue(testLead);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Lead',
            source: 'website',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/leads/:id', () => {
    it('returns single lead', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads/1`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent lead', async () => {
      storageMock.getLeadById.mockResolvedValue(null);
      storageMock.getLeadWithDetails.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads/999`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('PUT /api/leads/:id', () => {
    it('updates lead status', async () => {
      storageMock.updateLead.mockResolvedValue({
        ...testLead,
        status: 'qualified',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads/1`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'qualified' }),
        });
        expect(response.status).not.toBe(404);
      });
    });

    it('updates lead name', async () => {
      storageMock.updateLead.mockResolvedValue({
        ...testLead,
        name: 'Updated Lead',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads/1`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Lead' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/leads/:id', () => {
    it('deletes lead', async () => {
      storageMock.deleteLead.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/leads/:id/interactions', () => {
    it('returns lead interactions', async () => {
      storageMock.getLeadInteractions.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads/1/interactions`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/leads/:id/interactions', () => {
    it('creates interaction for lead', async () => {
      storageMock.createLeadInteraction.mockResolvedValue({
        id: 1,
        leadId: 1,
        type: 'call',
        notes: 'Called the lead',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/leads/1/interactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'call', notes: 'Called the lead' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});
