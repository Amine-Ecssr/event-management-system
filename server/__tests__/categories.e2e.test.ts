/**
 * E2E tests for Category endpoints
 * 
 * Tests: GET /api/categories, GET /api/categories/:id, POST /api/categories,
 *        PUT /api/categories/:id, DELETE /api/categories/:id
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  createTestCategory,
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

describe('GET /api/categories', () => {
  it('returns all categories', async () => {
    storageMock.getCategories.mockResolvedValueOnce([
      createTestCategory({ id: 1, nameEn: 'Conference', nameAr: 'مؤتمر' }),
      createTestCategory({ id: 2, nameEn: 'Workshop', nameAr: 'ورشة عمل' }),
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories`);
      const categories = await response.json();

      expect(response.status).toBe(200);
      expect(categories).toHaveLength(2);
    });
  });
});

describe('GET /api/categories/:id', () => {
  it('returns category by id', async () => {
    storageMock.getCategoryById.mockResolvedValueOnce(
      createTestCategory({ id: 1, nameEn: 'Conference', nameAr: 'مؤتمر' })
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories/1`);
      const category = await response.json();

      expect(response.status).toBe(200);
      expect(category.nameEn).toBe('Conference');
    });
  });

  it('returns 404 when category does not exist', async () => {
    storageMock.getCategoryById.mockResolvedValueOnce(undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories/999`);

      expect(response.status).toBe(404);
    });
  });
});

describe('POST /api/categories', () => {
  it('creates a new category', async () => {
    storageMock.getCategoryByName.mockResolvedValueOnce(undefined);
    storageMock.createCategory.mockResolvedValueOnce(
      createTestCategory({ id: 3, nameEn: 'Seminar', nameAr: 'ندوة' })
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nameEn: 'Seminar',
          nameAr: 'ندوة',
        }),
      });

      expect(response.status).toBe(201);
      expect(storageMock.createCategory).toHaveBeenCalled();
    });
  });

  it('returns existing category if already exists', async () => {
    const existingCategory = createTestCategory({ id: 3, nameEn: 'Seminar', nameAr: 'ندوة' });
    storageMock.getCategoryByName.mockResolvedValueOnce(existingCategory);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nameEn: 'Seminar',
          nameAr: 'ندوة',
        }),
      });
      const category = await response.json();

      expect(response.status).toBe(200);
      expect(category.id).toBe(3);
      expect(storageMock.createCategory).not.toHaveBeenCalled();
    });
  });
});

describe('PUT /api/categories/:id', () => {
  it('updates an existing category', async () => {
    storageMock.updateCategory.mockResolvedValueOnce(
      createTestCategory({ id: 1, nameEn: 'Updated Conference', nameAr: 'مؤتمر محدث' })
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories/1`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nameEn: 'Updated Conference',
          nameAr: 'مؤتمر محدث',
        }),
      });

      expect(response.status).toBe(200);
      expect(storageMock.updateCategory).toHaveBeenCalled();
    });
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes a category', async () => {
    storageMock.deleteCategory.mockResolvedValueOnce(undefined);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories/1`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);
      expect(storageMock.deleteCategory).toHaveBeenCalledWith(1);
    });
  });
});
