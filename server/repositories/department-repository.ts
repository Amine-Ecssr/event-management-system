/**
 * Department Repository (MSSQL version)
 * Handles all department/stakeholder-related database operations
 */
import { BaseRepository } from './base';
import { 
  departments, departmentEmails, departmentRequirements, eventDepartments,
  departmentAccounts, authIdentities, users, events, tasks,
  type Department, type InsertDepartment,
  type DepartmentEmail, type InsertDepartmentEmail,
  type DepartmentRequirement, type InsertDepartmentRequirement,
  type EventDepartment, type InsertEventDepartment,
  type DepartmentAccount, type InsertDepartmentAccount,
  type AuthIdentity, type InsertAuthIdentity,
  type Event, type Task
} from '@shared/schema.mssql';
import { eq, and, inArray, desc, SQLWrapper } from 'drizzle-orm';

export class DepartmentRepository extends BaseRepository {

  /* ---------------------------------------------------------
   * DEPARTMENTS
   * --------------------------------------------------------- */

  async getAllDepartments(): Promise<Array<Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>> {
    const all = await this.db.select().from(departments).orderBy(departments.name);

    return Promise.all(
      all.map(async (d: { id: number; }) => ({
        ...d,
        emails: await this.getDepartmentEmails(d.id),
        requirements: await this.getDepartmentRequirements(d.id)
      }))
    );
  }

  async getDepartment(id: number) {
    const [dept] = await this.db.select().from(departments).where(eq(departments.id, id));
    if (!dept) return undefined;

    return {
      ...dept,
      emails: await this.getDepartmentEmails(id),
      requirements: await this.getDepartmentRequirements(id)
    };
  }

  async getDepartmentsWithoutAccounts() {
    const all = await this.getAllDepartments();
    const accounts = await this.db.select().from(departmentAccounts);
    const withAccounts = new Set(accounts.map((a: { departmentId: any; }) => a.departmentId));

    return all.filter(d => !withAccounts.has(d.id));
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [dept] = await this.db.insert(departments).values(data).returning();
    return dept;
  }

  async updateDepartment(id: number, data: Partial<InsertDepartment>) {
    await this.db.update(departments).set(data).where(eq(departments.id, id));

    const [updated] = await this.db.select().from(departments).where(eq(departments.id, id));
    return updated;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const result = await this.db.delete(departments).where(eq(departments.id, id));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * DEPARTMENT EMAILS
   * --------------------------------------------------------- */

  async getDepartmentEmails(departmentId: number): Promise<DepartmentEmail[]> {
    return this.db
      .select()
      .from(departmentEmails)
      .where(eq(departmentEmails.departmentId, departmentId))
      .orderBy(departmentEmails.isPrimary);
  }

  async createDepartmentEmail(data: InsertDepartmentEmail) {
    const [email] = await this.db.insert(departmentEmails).values(data).returning();
    return email;
  }

  async updateDepartmentEmail(id: number, data: Partial<InsertDepartmentEmail>) {
    await this.db.update(departmentEmails).set(data).where(eq(departmentEmails.id, id));

    const [email] = await this.db.select().from(departmentEmails).where(eq(departmentEmails.id, id));
    return email;
  }

  async deleteDepartmentEmail(id: number): Promise<boolean> {
    const result = await this.db.delete(departmentEmails).where(eq(departmentEmails.id, id));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * DEPARTMENT REQUIREMENTS
   * --------------------------------------------------------- */

  async getDepartmentRequirements(departmentId: number) {
    return this.db
      .select()
      .from(departmentRequirements)
      .where(eq(departmentRequirements.departmentId, departmentId))
      .orderBy(departmentRequirements.isDefault);
  }

  async getRequirementById(id: number) {
    const [req] = await this.db.select().from(departmentRequirements).where(eq(departmentRequirements.id, id));
    return req;
  }

  async getAllRequirements() {
    return this.db
      .select()
      .from(departmentRequirements)
      .orderBy(departmentRequirements.departmentId, departmentRequirements.title);
  }

  async createDepartmentRequirement(data: InsertDepartmentRequirement) {
    const [req] = await this.db.insert(departmentRequirements).values(data).returning();
    return req;
  }

  async updateDepartmentRequirement(id: number, data: Partial<InsertDepartmentRequirement>) {
    await this.db.update(departmentRequirements).set(data).where(eq(departmentRequirements.id, id));

    const [req] = await this.db.select().from(departmentRequirements).where(eq(departmentRequirements.id, id));
    return req;
  }

  async deleteDepartmentRequirement(id: number): Promise<boolean> {
    const result = await this.db.delete(departmentRequirements).where(eq(departmentRequirements.id, id));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * EVENT DEPARTMENTS
   * --------------------------------------------------------- */

  async getEventDepartments(eventId: string) {
    return this.db.select().from(eventDepartments).where(eq(eventDepartments.eventId, eventId));
  }

  async getAllEventDepartmentsForAdmin() {
    const all = await this.db.select().from(eventDepartments);

    return Promise.all(
      all.map(async (ed: { eventId: string | SQLWrapper<unknown>; departmentId: number; id: any; }) => {
        const [event] = await this.db.select().from(events).where(eq(events.id, ed.eventId));
        const dept = await this.getDepartment(ed.departmentId);

        if (!event || !dept) {
          throw new Error(`Missing event or department for eventDepartment ${ed.id}`);
        }

        return {
          ...ed,
          event,
          department: {
            id: dept.id,
            name: dept.name,
            nameAr: dept.nameAr,
            keycloakGroupId: dept.keycloakGroupId,
            active: dept.active,
            ccList: dept.ccList,
            createdAt: dept.createdAt
          }
        };
      })
    );
  }

  async getEventDepartmentByEventAndDepartment(eventId: string, departmentId: number) {
    const [existing] = await this.db
      .select()
      .from(eventDepartments)
      .where(and(eq(eventDepartments.eventId, eventId), eq(eventDepartments.departmentId, departmentId)));

    return existing;
  }

  async createEventDepartment(data: InsertEventDepartment) {
    const [ed] = await this.db.insert(eventDepartments).values(data).returning();
    return ed;
  }

  async deleteEventDepartments(eventId: string) {
    await this.db.delete(eventDepartments).where(eq(eventDepartments.eventId, eventId));
  }

  async getEventDepartmentsWithDetails(eventId: string, taskRepo: { getTasksByEventDepartment(id: number): Promise<Task[]> }) {
    const records = await this.getEventDepartments(eventId);

    return Promise.all(
      records.map(async (ed: { departmentId: number; id: number; }) => {
        const dept = await this.getDepartment(ed.departmentId);
        if (!dept) throw new Error(`Department ${ed.departmentId} not found`);

        const tasks = await taskRepo.getTasksByEventDepartment(ed.id);

        return {
          ...ed,
          stakeholder: {
            id: dept.id,
            name: dept.name,
            nameAr: dept.nameAr,
            keycloakGroupId: dept.keycloakGroupId,
            active: dept.active,
            ccList: dept.ccList,
            createdAt: dept.createdAt
          },
          emails: dept.emails,
          requirements: dept.requirements,
          tasks
        };
      })
    );
  }

  async getEventsByDepartment(departmentId: number) {
    const links = await this.db.select().from(eventDepartments).where(eq(eventDepartments.departmentId, departmentId));
    const ids = links.map((l: { eventId: any; }) => l.eventId);

    if (ids.length === 0) return [];

    return this.db.select().from(events).where(inArray(events.id, ids)).orderBy(events.startDate);
  }

  async isDepartmentAssignedToEvent(departmentId: number, eventId: string) {
    const [row] = await this.db
      .select()
      .from(eventDepartments)
      .where(and(eq(eventDepartments.departmentId, departmentId), eq(eventDepartments.eventId, eventId)));

    return !!row;
  }

  async getEventDepartmentsByDepartmentId(eventId: string, departmentId: number) {
    const records = await this.db
      .select()
      .from(eventDepartments)
      .where(and(eq(eventDepartments.eventId, eventId), eq(eventDepartments.departmentId, departmentId)));

    return Promise.all(
      records.map(async (ed: { departmentId: number; }) => {
        const dept = await this.getDepartment(ed.departmentId);
        if (!dept) throw new Error(`Department ${ed.departmentId} not found`);

        return {
          ...ed,
          stakeholder: {
            id: dept.id,
            name: dept.name,
            nameAr: dept.nameAr,
            keycloakGroupId: dept.keycloakGroupId,
            active: dept.active,
            ccList: dept.ccList,
            createdAt: dept.createdAt
          },
          emails: dept.emails,
          requirements: dept.requirements
        };
      })
    );
  }

  async getEventDepartment(eventDepartmentId: number) {
    const [row] = await this.db.select().from(eventDepartments).where(eq(eventDepartments.id, eventDepartmentId));
    return row;
  }

  async updateEventDepartmentLastReminder(id: number) {
    await this.db.update(eventDepartments).set({ lastReminderSentAt: new Date() }).where(eq(eventDepartments.id, id));
  }

  /* ---------------------------------------------------------
   * DEPARTMENT ACCOUNTS
   * --------------------------------------------------------- */

  async getDepartmentAccountByUserId(userId: number) {
    const [acc] = await this.db.select().from(departmentAccounts).where(eq(departmentAccounts.userId, userId));
    return acc;
  }

  async updateDepartmentAccountLastLogin(userId: number) {
    await this.db.update(departmentAccounts).set({ lastLoginAt: new Date() }).where(eq(departmentAccounts.userId, userId));
  }

  async getAllDepartmentAccounts() {
    return this.db
      .select({
        id: departmentAccounts.id,
        userId: departmentAccounts.userId,
        departmentId: departmentAccounts.departmentId,
        primaryEmailId: departmentAccounts.primaryEmailId,
        lastLoginAt: departmentAccounts.lastLoginAt,
        createdAt: departmentAccounts.createdAt,
        departmentName: departments.name,
        username: users.username,
        primaryEmail: departmentEmails.email
      })
      .from(departmentAccounts)
      .innerJoin(departments, eq(departmentAccounts.departmentId, departments.id))
      .innerJoin(users, eq(departmentAccounts.userId, users.id))
      .innerJoin(departmentEmails, eq(departmentAccounts.primaryEmailId, departmentEmails.id))
      .orderBy(departments.name);
  }

  async getDepartmentAccountByDepartmentId(departmentId: number) {
    const [acc] = await this.db.select().from(departmentAccounts).where(eq(departmentAccounts.departmentId, departmentId));
    return acc;
  }

  async createDepartmentAccount(data: InsertDepartmentAccount) {
    const [acc] = await this.db.insert(departmentAccounts).values(data).returning();
    return acc;
  }

  async deleteDepartmentAccount(id: number): Promise<boolean> {
    const result = await this.db.delete(departmentAccounts).where(eq(departmentAccounts.id, id));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * AUTH IDENTITIES
   * --------------------------------------------------------- */

  async createAuthIdentity(data: InsertAuthIdentity) {
    const [identity] = await this.db.insert(authIdentities).values(data).returning();
    return identity;
  }

  /* ---------------------------------------------------------
   * KEYCLOAK DEPARTMENT SYNC
   * --------------------------------------------------------- */

  async getDepartmentByKeycloakGroupId(keycloakGroupId: string) {
    const [dept] = await this.db
      .select()
      .from(departments)
      .where(eq(departments.keycloakGroupId, keycloakGroupId));

    return dept;
  }

  async getOrCreateDepartmentByName(name: string, keycloakGroupId?: string) {
    if (keycloakGroupId) {
      const [existing] = await this.db
        .select()
        .from(departments)
        .where(eq(departments.keycloakGroupId, keycloakGroupId));

      if (existing) return existing;
    }

    const [byName] = await this.db.select().from(departments).where(eq(departments.name, name));

    if (byName) {
      if (keycloakGroupId && !byName.keycloakGroupId) {
        await this.db.update(departments).set({ keycloakGroupId }).where(eq(departments.id, byName.id));

        const [updated] = await this.db.select().from(departments).where(eq(departments.id, byName.id));
        return updated;
      }
      return byName;
    }

    const [created] = await this.db
      .insert(departments)
      .values({ name, keycloakGroupId, nameAr: null })
      .returning();

    console.log(`[DepartmentRepository] Created placeholder department: ${name}`);
    return created;
  }

  async linkUserToDepartment(userId: number, departmentId: number, primaryEmailId: number) {
    const [acc] = await this.db
      .insert(departmentAccounts)
      .values({ userId, departmentId, primaryEmailId })
      .returning();

    return acc;
  }

  async getUserDepartments(userId: number) {
    const rows = await this.db
      .select({ department: departments })
      .from(departments)
      .innerJoin(departmentAccounts, eq(departments.id, departmentAccounts.departmentId))
      .where(eq(departmentAccounts.userId, userId));

    return rows.map((r: { department: any; }) => r.department);
  }
}
