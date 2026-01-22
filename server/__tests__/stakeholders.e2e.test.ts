/**
 * E2E tests for Stakeholder (Department) endpoints
 * 
 * Tests: GET /api/stakeholders, POST /api/stakeholders, PATCH /api/stakeholders/:id,
 *        DELETE /api/stakeholders/:id, Stakeholder emails and requirements
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  createTestDepartment,
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

describe('GET /api/stakeholders', () => {
  it('returns all stakeholders', async () => {
    storageMock.getAllDepartments.mockResolvedValueOnce([
      createTestDepartment({ id: 1, name: 'Operations' }),
      createTestDepartment({ id: 2, name: 'IT' }),
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholders`);
      const stakeholders = await response.json();

      expect(response.status).toBe(200);
      expect(stakeholders).toHaveLength(2);
    });
  });
});

describe('POST /api/stakeholders', () => {
  it('creates a new stakeholder', async () => {
    storageMock.createDepartment.mockResolvedValueOnce(
      createTestDepartment({ id: 3, name: 'Marketing' })
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Marketing',
          active: true,
        }),
      });

      expect(response.status).toBe(201);
      expect(storageMock.createDepartment).toHaveBeenCalled();
    });
  });
});

describe('PATCH /api/stakeholders/:id', () => {
  it('updates a stakeholder', async () => {
    storageMock.updateDepartment.mockResolvedValueOnce(
      createTestDepartment({ id: 1, name: 'Operations Updated' })
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholders/1`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Operations Updated',
        }),
      });

      expect(response.status).toBe(200);
      expect(storageMock.updateDepartment).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });
});

describe('DELETE /api/stakeholders/:id', () => {
  it('deletes a stakeholder', async () => {
    storageMock.deleteDepartment.mockResolvedValueOnce(true);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholders/1`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);
      expect(storageMock.deleteDepartment).toHaveBeenCalledWith(1);
    });
  });
});

describe('POST /api/stakeholders/:stakeholderId/emails', () => {
  it('adds email to stakeholder', async () => {
    storageMock.createDepartmentEmail.mockResolvedValueOnce({
      id: 10,
      departmentId: 1,
      email: 'new@example.com',
      label: 'Secondary',
      primary: false,
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholders/1/emails`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'new@example.com',
          label: 'Secondary',
          primary: false,
        }),
      });

      expect(response.status).toBe(201);
      expect(storageMock.createDepartmentEmail).toHaveBeenCalled();
    });
  });
});

describe('DELETE /api/stakeholder-emails/:id', () => {
  it('deletes an email', async () => {
    storageMock.deleteDepartmentEmail.mockResolvedValueOnce(true);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholder-emails/10`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);
      expect(storageMock.deleteDepartmentEmail).toHaveBeenCalledWith(10);
    });
  });
});

describe('POST /api/stakeholders/:stakeholderId/requirements', () => {
  it('adds requirement to stakeholder', async () => {
    storageMock.createDepartmentRequirement.mockResolvedValueOnce({
      id: 20,
      departmentId: 1,
      title: 'New Requirement',
      description: 'Details',
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholders/1/requirements`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'New Requirement',
          description: 'Details',
        }),
      });

      expect(response.status).toBe(201);
      expect(storageMock.createDepartmentRequirement).toHaveBeenCalled();
    });
  });
});

describe('DELETE /api/stakeholder-requirements/:id', () => {
  it('deletes a requirement', async () => {
    storageMock.deleteDepartmentRequirement.mockResolvedValueOnce(true);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stakeholder-requirements/20`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);
      expect(storageMock.deleteDepartmentRequirement).toHaveBeenCalledWith(20);
    });
  });
});

describe('GET /api/events/:eventId/stakeholders', () => {
  it('returns stakeholders for event', async () => {
    storageMock.getEventDepartmentsWithDetails.mockResolvedValueOnce([
      {
        id: 1,
        eventId: 'event-1',
        departmentId: 1,
        departmentName: 'Operations',
      },
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/events/event-1/stakeholders`);
      const stakeholders = await response.json();

      expect(response.status).toBe(200);
      expect(stakeholders).toHaveLength(1);
    });
  });
});
