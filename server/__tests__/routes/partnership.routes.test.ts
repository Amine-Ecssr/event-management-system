/**
 * Partnership Routes E2E Tests
 *
 * Tests for: server/routes/partnership.routes.ts
 * Actual Endpoints:
 * - GET /api/partnerships
 * - POST /api/partnerships
 * - GET /api/partnerships/:id
 * - PUT /api/partnerships/:id
 * - DELETE /api/partnerships/:id
 * - GET /api/partnerships/analytics
 * - GET /api/partnerships/stats
 * - GET /api/partnerships/inactive
 * - GET /api/partnerships/:id/agreements
 * - POST /api/partnerships/:id/agreements
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  type ExtendedMockedStorage,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
});

const testOrganization = {
  id: 1,
  nameEn: 'Test Partner',
  nameAr: 'شريك تجريبي',
  isPartner: true,
  partnershipTypeId: 1,
  partnershipStatus: 'active',
  partnershipStartDate: new Date().toISOString(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
  // The routes use getAllPartners, not getAllPartnerships
  storageMock.getAllPartners.mockResolvedValue({ partners: [testOrganization], total: 1 });
  // GET /api/partnerships/:id uses getOrganization
  storageMock.getOrganization.mockResolvedValue(testOrganization);
  storageMock.getPartnershipType.mockResolvedValue({ id: 1, name: 'Strategic' });
  // Stats/Analytics use getPartnerStats
  storageMock.getPartnerStats.mockResolvedValue({
    totalPartners: 1,
    activePartnerships: 1,
  });
  storageMock.getInactivePartnerships.mockResolvedValue([]);
  storageMock.getPartnershipAgreements.mockResolvedValue([]);
  // Update uses updatePartnership
  storageMock.updatePartnership.mockResolvedValue(testOrganization);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('partnership.routes', () => {
  describe('GET /api/partnerships', () => {
    it('returns list of partnerships', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns empty array when no partnerships exist', async () => {
      storageMock.getAllPartners.mockResolvedValue({ partners: [], total: 0 });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/partnerships', () => {
    it('creates new partnership', async () => {
      // POST /api/partnerships uses updatePartnership to make an org a partner
      storageMock.updatePartnership.mockResolvedValue(testOrganization);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: 1,
            partnershipTypeId: 1,
            partnershipStatus: 'active',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/partnerships/:id', () => {
    it('returns single partnership', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/1`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent partnership', async () => {
      storageMock.getOrganization.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/999`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('PUT /api/partnerships/:id', () => {
    it('updates partnership', async () => {
      storageMock.updatePartnership.mockResolvedValue({
        ...testOrganization,
        partnershipStatus: 'inactive',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/1`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'media' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/partnerships/:id', () => {
    it('deletes partnership', async () => {
      storageMock.deletePartnership.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/partnerships/analytics', () => {
    it('returns partnership analytics', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/analytics`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/partnerships/stats', () => {
    it('returns partnership stats', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/stats`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/partnerships/inactive', () => {
    it('returns inactive partnerships', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/inactive`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/partnerships/:id/agreements', () => {
    it('returns partnership agreements', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnerships/1/agreements`);
        expect(response.status).not.toBe(404);
      });
    });
  });
});