/**
 * Category Repository
 * Handles all category-related database operations
 */
import { BaseRepository } from './base';
import { categories, type Category, type InsertCategory } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class CategoryRepository extends BaseRepository {
  async getCategories(): Promise<Category[]> {
    return await this.db.select().from(categories).orderBy(categories.nameEn);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await this.db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryByName(nameEn: string): Promise<Category | undefined> {
    const [category] = await this.db.select().from(categories).where(eq(categories.nameEn, nameEn));
    return category || undefined;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [category] = await this.db.insert(categories).values(data).returning();
    return category;
  }

  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await this.db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await this.db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();
    return result.length > 0;
  }
}
