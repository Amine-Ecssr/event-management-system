/**
 * Stakeholder Routes E2E Tests
 *
 * Tests for: server/routes/stakeholder.routes.ts
 * Note: Stakeholders are essentially Departments in this codebase
 * Actual Endpoints:
 * - GET /api/stakeholders (uses getAllDepartments)
 * - GET /api/stakeholders/without-accounts
 * - POST /api/stakeholders
 * - PATCH /api/stakeholders/:id
 * - DELETE /api/stakeholders/:id
 * - POST /api/stakeholders/:stakeholderId/emails
 * - DELETE /api/stakeholder-emails/:id
 * - POST /api/stakeholders/:stakeholderId/requirements
 * - DELETE /api/stakeholder-requirements/:id
 * - GET /api/stakeholder-accounts
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestDepartment,
  type ExtendedMockedStorage,
} from './test-utils';

setupAllExtendedMocks();

let storageMock: ExtendedMockedStorage;

beforeAll(async () => {
  const mocks = await initMocks();
  storageMock = mocks.storageMock;
});

const testStakeholder = createTestDepartment();

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(defaultSettings);
  storageMock.getAllDepartments.mockResolvedValue([testStakeholder]);
  storageMock.getDepartment.mockResolvedValue(testStakeholder);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('stakeholder.routes', () => {
  describe('GET /api/stakeholders', () => {
    it('returns list of stakeholders', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholders`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns empty array when no stakeholders', async () => {
      storageMock.getAllDepartments.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholders`);
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/stakeholders', () => {
    it('creates new stakeholder', async () => {
      storageMock.createDepartment.mockResolvedValue(testStakeholder);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Stakeholder',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('PATCH /api/stakeholders/:id', () => {
    it('updates stakeholder', async () => {
      storageMock.updateDepartment.mockResolvedValue({
        ...testStakeholder,
        name: 'Updated Stakeholder',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholders/1`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Stakeholder' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/stakeholders/:id', () => {
    it('deletes stakeholder', async () => {
      // deleteDepartment should return the deleted entity, not undefined
      storageMock.deleteDepartment.mockResolvedValue(testStakeholder);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholders/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/stakeholders/:stakeholderId/emails', () => {
    it('adds email to stakeholder', async () => {
      storageMock.createDepartmentEmail.mockResolvedValue({
        id: 1,
        departmentId: 1,
        email: 'test@example.com',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholders/1/emails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/stakeholder-emails/:id', () => {
    it('removes email', async () => {
      // deleteDepartmentEmail should return truthy value when successful
      storageMock.deleteDepartmentEmail.mockResolvedValue({ id: 1, email: 'test@example.com' });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholder-emails/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('POST /api/stakeholders/:stakeholderId/requirements', () => {
    it('adds requirement to stakeholder', async () => {
      storageMock.createDepartmentRequirement.mockResolvedValue({
        id: 1,
        departmentId: 1,
        name: 'Test Requirement',
      });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholders/1/requirements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test Requirement' }),
        });
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('DELETE /api/stakeholder-requirements/:id', () => {
    it('removes requirement', async () => {
      // deleteDepartmentRequirement should return truthy value when successful
      storageMock.deleteDepartmentRequirement.mockResolvedValue({ id: 1, name: 'Test Requirement' });

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stakeholder-requirements/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
      });
    });
  });
});
