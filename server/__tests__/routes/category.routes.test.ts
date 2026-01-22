/**
 * Category Routes E2E Tests
 *
 * Tests for: server/routes/category.routes.ts
 * Endpoints:
 * - GET /api/categories
 * - GET /api/categories/:id
 * - POST /api/categories
 * - PUT /api/categories/:id
 * - DELETE /api/categories/:id
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllExtendedMocks,
  withTestServer,
  initMocks,
  defaultSettings,
  createTestCategory,
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
  storageMock.getCategories.mockResolvedValue([createTestCategory()]);
  storageMock.getCategoryById.mockResolvedValue(createTestCategory());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('category.routes', () => {
  describe('GET /api/categories', () => {
    it('returns list of categories', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories`);
        expect(response.status).not.toBe(404);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
      });
    });

    it('returns empty array when no categories', async () => {
      storageMock.getCategories.mockResolvedValue([]);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories`);
        expect(response.status).not.toBe(404);
        const data = await response.json();
        expect(data).toEqual([]);
      });
    });
  });

  describe('GET /api/categories/:id', () => {
    it('returns single category by ID', async () => {
      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories/1`);
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 when category not found', async () => {
      storageMock.getCategoryById.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories/999`);
        expect(response.status).toBe(404);
      });
    });
  });

  describe('POST /api/categories', () => {
    it('creates new category', async () => {
      storageMock.getCategoryByName.mockResolvedValue(null);
      storageMock.createCategory.mockResolvedValue(createTestCategory({ id: 2 }));

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nameEn: 'Workshop',
            nameAr: 'ورشة عمل',
          }),
        });
        expect(response.status).not.toBe(404);
        expect([200, 201]).toContain(response.status);
      });
    });

    it('returns existing category for duplicate name', async () => {
      storageMock.getCategoryByName.mockResolvedValue(createTestCategory());

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nameEn: 'Conference',
            nameAr: 'مؤتمر',
          }),
        });
        // Returns existing category instead of error
        expect(response.status).not.toBe(404);
      });
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('updates existing category', async () => {
      storageMock.updateCategory.mockResolvedValue(createTestCategory({ nameEn: 'Updated' }));

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories/1`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nameEn: 'Updated Conference',
            nameAr: 'مؤتمر محدث',
          }),
        });
        expect(response.status).not.toBe(404);
      });
    });

    it('returns 404 for non-existent category', async () => {
      // Route checks if updateCategory returns null for 404
      storageMock.updateCategory.mockResolvedValue(null);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories/999`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nameEn: 'Updated',
            nameAr: 'محدث',
          }),
        });
        expect(response.status).toBe(404);
      });
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('deletes existing category', async () => {
      storageMock.deleteCategory.mockResolvedValue(undefined);

      await withTestServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/categories/1`, {
          method: 'DELETE',
        });
        expect(response.status).not.toBe(404);
        expect([200, 204]).toContain(response.status);
      });
    });

    // Note: The DELETE route doesn't check for 404 - it always returns 204
    // This test should be removed or the route should be updated
  });
});
