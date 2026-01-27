/**
 * Category Repository (MSSQL version)
 * Handles all category-related database operations
 */
import { BaseRepository } from './base';
import { categories, type Category, type InsertCategory } from '@shared/schema.mssql';
import { eq } from 'drizzle-orm';

export class CategoryRepository extends BaseRepository {

  async getCategories(): Promise<Category[]> {
    return this.db
      .select()
      .from(categories)
      .orderBy(categories.nameEn);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));

    return category;
  }

  async getCategoryByName(nameEn: string): Promise<Category | undefined> {
    const [category] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.nameEn, nameEn));

    return category;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    // INSERT returning works on MSSQL
    const [category] = await this.db
      .insert(categories)
      .values(data)
      .returning();

    return category;
  }

  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined> {
    // MSSQL: update().returning() is not supported
    await this.db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id));

    // Re-select the updated row
    const [category] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));

    return category;
  }

  async deleteCategory(id: number): Promise<boolean> {
    // MSSQL: delete().returning() is not supported
    const result = await this.db
      .delete(categories)
      .where(eq(categories.id, id));

    return result.rowsAffected > 0;
  }
}
