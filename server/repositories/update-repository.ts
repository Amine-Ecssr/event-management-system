/**
 * Update Repository (MSSQL version)
 * Handles all weekly/monthly update database operations
 */
import { BaseRepository } from './base';
import { updates, departments, type Update, type InsertUpdate } from '@shared/schema.mssql';
import { eq, and, isNull, desc } from 'drizzle-orm';
import type { UpdateWithDepartment } from '../updates-formatter';

export class UpdateRepository extends BaseRepository {

  async getUpdate(type: 'weekly' | 'monthly', periodStart: string): Promise<Update | undefined> {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(
        eq(updates.type, type),
        eq(updates.periodStart, new Date(periodStart)),
        isNull(updates.departmentId)
      ));

    return update;
  }

  async getUpdateForDepartment(type: 'weekly' | 'monthly', periodStart: Date, departmentId: number) {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(
        eq(updates.type, type),
        eq(updates.periodStart, periodStart),
        eq(updates.departmentId, departmentId)
      ));

    return update;
  }

  async getLatestUpdate(type: 'weekly' | 'monthly') {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), isNull(updates.departmentId)))
      .orderBy(desc(updates.periodStart))
      .limit(1);

    return update;
  }

  async getAllUpdates(type: 'weekly' | 'monthly') {
    return this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), isNull(updates.departmentId)))
      .orderBy(desc(updates.periodStart));
  }

  async getLatestUpdateForDepartment(type: 'weekly' | 'monthly', departmentId: number) {
    const [update] = await this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.departmentId, departmentId)))
      .orderBy(desc(updates.periodStart))
      .limit(1);

    return update;
  }

  async getAllUpdatesForDepartment(type: 'weekly' | 'monthly', departmentId: number) {
    return this.db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.departmentId, departmentId)))
      .orderBy(desc(updates.periodStart));
  }

  async getUpdatesForPeriodWithDepartments(type: 'weekly' | 'monthly', periodStart: string): Promise<UpdateWithDepartment[]> {
    const rows = await this.db
      .select({
        update: updates,
        departmentName: departments.name,
        departmentNameAr: departments.nameAr,
      })
      .from(updates)
      .leftJoin(departments, eq(updates.departmentId, departments.id))
      .where(and(eq(updates.type, type), eq(updates.periodStart, new Date(periodStart))))
      .orderBy(departments.name, updates.departmentId);

    return rows.map((row: { update: any; departmentName: any; departmentNameAr: any; }) => ({
      ...row.update,
      departmentName: row.departmentName,
      departmentNameAr: row.departmentNameAr,
    }));
  }

  async createOrUpdateUpdate(data: InsertUpdate): Promise<Update> {
    // Check if an update already exists
    const existing = data.departmentId
      ? await this.getUpdateForDepartment(data.type, new Date(data.periodStart), data.departmentId)
      : await this.getUpdate(data.type, data.periodStart instanceof Date ? data.periodStart.toISOString() : data.periodStart);

    if (existing) {
      // MSSQL: update().returning() is not supported
      await this.db
        .update(updates)
        .set({
          content: data.content,
          updatedAt: new Date(),
          updatedByUserId: data.updatedByUserId
        })
        .where(eq(updates.id, existing.id));

      const [updated] = await this.db
        .select()
        .from(updates)
        .where(eq(updates.id, existing.id));

      return updated!;
    }

    // INSERT returning works on MSSQL
    const [created] = await this.db
      .insert(updates)
      .values(data)
      .returning();

    return created;
  }
}
