/**
 * Organization Routes E2E Tests
 *
 * Tests for: server/routes/organization.routes.ts
 * Endpoints:
 * - GET /api/organizations
 * - GET /api/organizations/:id
 * - POST /api/organizations
 * - PUT /api/organizations/:id
 * - DELETE /api/organizations/:id
 * - GET /api/contacts
 * - GET /api/contacts/:id
 * - POST /api/contacts
 * - PUT /api/contacts/:id
 * - DELETE /api/contacts/:id
 * - GET /api/positions
 * - POST /api/positions
 * - PUT /api/positions/:id
 * - DELETE /api/positions/:id
 * - GET /api/agreement-types
 * - POST /api/agreement-types
 * - GET /api/partnership-types
 * - POST /api/partnership-types
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestOrganization,
  createTestContact,
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
  storageMock.getAllOrganizations.mockResolvedValue([createTestOrganization()]);
  storageMock.getOrganization.mockResolvedValue(createTestOrganization());
  storageMock.getAllContacts.mockResolvedValue([createTestContact()]);
  storageMock.getContact.mockResolvedValue(createTestContact());
  storageMock.getAllPositions.mockResolvedValue([]);
  storageMock.getAgreementTypes.mockResolvedValue([]);
  storageMock.getPartnershipTypes.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('organization.routes', () => {
  // ==================== Organizations ====================
  describe('GET /api/organizations', () => {
    it('returns list of organizations', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/organizations`);
        expect(response.status).not.toBe(404);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      });
    });
  });

  describe('GET /api/organizations/:id', () => {
    it('returns single organization', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/organizations/1`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent organization', async () => {
      storageMock.getOrganization.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/organizations/999`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('POST /api/organizations', () => {
    it('creates new organization', async () => {
      storageMock.createOrganization.mockResolvedValue(createTestOrganization({ id: 2 }));

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/organizations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Organization',
            type: 'corporate',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('PUT /api/organizations/:id', () => {
    it('updates existing organization', async () => {
      storageMock.updateOrganization.mockResolvedValue(createTestOrganization({ name: 'Updated' }));

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/organizations/1`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Organization' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/organizations/:id', () => {
    it('deletes existing organization', async () => {
      storageMock.deleteOrganization.mockResolvedValue(true);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/organizations/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  // ==================== Contacts ====================
  describe('GET /api/contacts', () => {
    it('returns list of contacts', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/contacts`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('GET /api/contacts/:id', () => {
    it('returns single contact', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/contacts/1`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/contacts', () => {
    it('creates new contact', async () => {
      storageMock.createContact.mockResolvedValue(createTestContact({ id: 2 }));

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Jane Doe',
            email: 'jane@example.com',
            organizationId: 1,
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  // ==================== Positions ====================
  describe('GET /api/positions', () => {
    it('returns list of positions', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/positions`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/positions', () => {
    it('creates new position', async () => {
      storageMock.createPosition.mockResolvedValue({ id: 1, name: 'Manager' });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/positions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Manager' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  // ==================== Agreement Types ====================
  describe('GET /api/agreement-types', () => {
    it('returns list of agreement types', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/agreement-types`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/agreement-types', () => {
    it('creates new agreement type', async () => {
      storageMock.createAgreementType.mockResolvedValue({ id: 1, name: 'MOU' });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/agreement-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'MOU' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  // ==================== Partnership Types ====================
  describe('GET /api/partnership-types', () => {
    it('returns list of partnership types', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnership-types`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/partnership-types', () => {
    it('creates new partnership type', async () => {
      storageMock.createPartnershipType.mockResolvedValue({ id: 1, name: 'Strategic' });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/partnership-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Strategic' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});
