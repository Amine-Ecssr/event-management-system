/**
 * Update Repository
 * Handles all weekly/monthly update database operations
 */
import { BaseRepository } from './base';
import { updates, departments, type Update, type InsertUpdate } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import type { UpdateWithDepartment } from '../updates-formatter';

export class UpdateRepository extends BaseRepository {
  async getUpdate(type: 'weekly' | 'monthly', periodStart: string): Promise<Update | undefined> {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.periodStart, periodStart), isNull(updates.departmentId)));
    return update || undefined;
  }
  
  async getUpdateForDepartment(type: 'weekly' | 'monthly', periodStart: string, departmentId: number): Promise<Update | undefined> {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.periodStart, periodStart), eq(updates.departmentId, departmentId)));
    return update || undefined;
  }
  
  async getLatestUpdate(type: 'weekly' | 'monthly'): Promise<Update | undefined> {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), isNull(updates.departmentId)))
      .orderBy(desc(updates.periodStart))
      .limit(1);
    return update || undefined;
  }
  
  async getAllUpdates(type: 'weekly' | 'monthly'): Promise<Update[]> {
    return await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), isNull(updates.departmentId)))
      .orderBy(desc(updates.periodStart));
  }
  
  async getLatestUpdateForDepartment(type: 'weekly' | 'monthly', departmentId: number): Promise<Update | undefined> {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.departmentId, departmentId)))
      .orderBy(desc(updates.periodStart))
      .limit(1);
    return update || undefined;
  }
  
  async getAllUpdatesForDepartment(type: 'weekly' | 'monthly', departmentId: number): Promise<Update[]> {
    return await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.departmentId, departmentId)))
      .orderBy(desc(updates.periodStart));
  }

  async getUpdatesForPeriodWithDepartments(type: 'weekly' | 'monthly', periodStart: string): Promise<UpdateWithDepartment[]> {
    const results = await this.db
      .select({
        update: updates,
        departmentName: departments.name,
        departmentNameAr: departments.nameAr,
      })
      .from(updates)
      .leftJoin(departments, eq(updates.departmentId, departments.id))
      .where(and(eq(updates.type, type), eq(updates.periodStart, periodStart)))
      .orderBy(departments.name, updates.departmentId);

    return results.map((row) => ({
      ...row.update,
      departmentName: row.departmentName,
      departmentNameAr: row.departmentNameAr,
    }));
  }

  async createOrUpdateUpdate(data: InsertUpdate): Promise<Update> {
    // Check if an update already exists for this type, period, and departmentId combination
    let existing: Update | undefined;
    if (data.departmentId) {
      existing = await this.getUpdateForDepartment(data.type, data.periodStart, data.departmentId);
    } else {
      existing = await this.getUpdate(data.type, data.periodStart);
    }
    
    if (existing) {
      // Update existing
      const [updated] = await this.db
        .update(updates)
        .set({ 
          content: data.content, 
          updatedAt: new Date(),
          updatedByUserId: data.updatedByUserId 
        })
        .where(eq(updates.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await this.db
        .insert(updates)
        .values(data)
        .returning();
      return created;
    }
  }
}
