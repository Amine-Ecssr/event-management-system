/**
 * Department Repository
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
} from '@shared/schema';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';

export class DepartmentRepository extends BaseRepository {
  // Core Department operations
  async getAllDepartments(): Promise<Array<Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>> {
    const allStakeholders = await this.db.select().from(departments).orderBy(departments.name);
    
    const result = await Promise.all(
      allStakeholders.map(async (stakeholder) => {
        const emails = await this.getDepartmentEmails(stakeholder.id);
        const requirements = await this.getDepartmentRequirements(stakeholder.id);
        return { ...stakeholder, emails, requirements };
      })
    );
    
    return result;
  }

  async getDepartment(id: number): Promise<(Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }) | undefined> {
    const [stakeholder] = await this.db.select().from(departments).where(eq(departments.id, id));
    if (!stakeholder) return undefined;
    
    const emails = await this.getDepartmentEmails(id);
    const requirements = await this.getDepartmentRequirements(id);
    
    return { ...stakeholder, emails, requirements };
  }

  async getDepartmentsWithoutAccounts(): Promise<Array<Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>> {
    const allStakeholdersWithDetails = await this.getAllDepartments();
    const accountsData = await this.db.select().from(departmentAccounts);
    const departmentIdsWithAccounts = new Set(accountsData.map(acc => acc.departmentId));
    
    return allStakeholdersWithDetails.filter(
      stakeholder => !departmentIdsWithAccounts.has(stakeholder.id)
    );
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [stakeholder] = await this.db
      .insert(departments)
      .values(data)
      .returning();
    return stakeholder;
  }

  async updateDepartment(id: number, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [stakeholder] = await this.db
      .update(departments)
      .set(data)
      .where(eq(departments.id, id))
      .returning();
    return stakeholder || undefined;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const result = await this.db
      .delete(departments)
      .where(eq(departments.id, id))
      .returning();
    return result.length > 0;
  }

  // Department Email operations
  async getDepartmentEmails(departmentId: number): Promise<DepartmentEmail[]> {
    return await this.db
      .select()
      .from(departmentEmails)
      .where(eq(departmentEmails.departmentId, departmentId))
      .orderBy(departmentEmails.isPrimary);
  }

  async createDepartmentEmail(data: InsertDepartmentEmail): Promise<DepartmentEmail> {
    const [email] = await this.db
      .insert(departmentEmails)
      .values(data)
      .returning();
    return email;
  }

  async updateDepartmentEmail(id: number, data: Partial<InsertDepartmentEmail>): Promise<DepartmentEmail | undefined> {
    const [email] = await this.db
      .update(departmentEmails)
      .set(data)
      .where(eq(departmentEmails.id, id))
      .returning();
    return email || undefined;
  }

  async deleteDepartmentEmail(id: number): Promise<boolean> {
    const result = await this.db
      .delete(departmentEmails)
      .where(eq(departmentEmails.id, id))
      .returning();
    return result.length > 0;
  }

  // Department Requirement operations
  async getDepartmentRequirements(departmentId: number): Promise<DepartmentRequirement[]> {
    return await this.db
      .select()
      .from(departmentRequirements)
      .where(eq(departmentRequirements.departmentId, departmentId))
      .orderBy(departmentRequirements.isDefault);
  }

  async getRequirementById(id: number): Promise<DepartmentRequirement | undefined> {
    const [requirement] = await this.db
      .select()
      .from(departmentRequirements)
      .where(eq(departmentRequirements.id, id));
    return requirement || undefined;
  }

  async getAllRequirements(): Promise<DepartmentRequirement[]> {
    return await this.db
      .select()
      .from(departmentRequirements)
      .orderBy(departmentRequirements.departmentId, departmentRequirements.title);
  }

  async createDepartmentRequirement(data: InsertDepartmentRequirement): Promise<DepartmentRequirement> {
    const [requirement] = await this.db
      .insert(departmentRequirements)
      .values(data)
      .returning();
    return requirement;
  }

  async updateDepartmentRequirement(id: number, data: Partial<InsertDepartmentRequirement>): Promise<DepartmentRequirement | undefined> {
    const [requirement] = await this.db
      .update(departmentRequirements)
      .set(data)
      .where(eq(departmentRequirements.id, id))
      .returning();
    return requirement || undefined;
  }

  async deleteDepartmentRequirement(id: number): Promise<boolean> {
    const result = await this.db
      .delete(departmentRequirements)
      .where(eq(departmentRequirements.id, id))
      .returning();
    return result.length > 0;
  }

  // Event Department operations
  async getEventDepartments(eventId: string): Promise<EventDepartment[]> {
    return await this.db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.eventId, eventId));
  }

  async getAllEventDepartmentsForAdmin(): Promise<Array<EventDepartment & { event: Event, department: Department }>> {
    const allEventDepartments = await this.db
      .select()
      .from(eventDepartments);
    
    const result = await Promise.all(
      allEventDepartments.map(async (es) => {
        const [event] = await this.db.select().from(events).where(eq(events.id, es.eventId));
        const stakeholder = await this.getDepartment(es.departmentId);
        
        if (!event || !stakeholder) {
          throw new Error(`Event or stakeholder not found for event-stakeholder ${es.id}`);
        }
        
        return {
          ...es,
          event,
          department: {
            id: stakeholder.id,
            name: stakeholder.name,
            nameAr: stakeholder.nameAr,
            keycloakGroupId: stakeholder.keycloakGroupId,
            active: stakeholder.active,
            ccList: stakeholder.ccList,
            createdAt: stakeholder.createdAt,
          },
        };
      })
    );
    
    return result;
  }

  async getEventDepartmentByEventAndDepartment(eventId: string, departmentId: number): Promise<EventDepartment | undefined> {
    const [existing] = await this.db
      .select()
      .from(eventDepartments)
      .where(and(eq(eventDepartments.eventId, eventId), eq(eventDepartments.departmentId, departmentId)))
      .limit(1);

    return existing;
  }

  async createEventDepartment(data: InsertEventDepartment): Promise<EventDepartment> {
    const [eventStakeholder] = await this.db
      .insert(eventDepartments)
      .values(data)
      .returning();
    return eventStakeholder;
  }

  async deleteEventDepartments(eventId: string): Promise<void> {
    await this.db
      .delete(eventDepartments)
      .where(eq(eventDepartments.eventId, eventId));
  }

  async getEventDepartmentsWithDetails(
    eventId: string,
    taskRepo: { getTasksByEventDepartment(id: number): Promise<Task[]> }
  ): Promise<Array<EventDepartment & { stakeholder: Department, emails: DepartmentEmail[], requirements: DepartmentRequirement[], tasks: Task[] }>> {
    const eventStakeholderRecords = await this.getEventDepartments(eventId);
    
    const result = await Promise.all(
      eventStakeholderRecords.map(async (es) => {
        const stakeholder = await this.getDepartment(es.departmentId);
        if (!stakeholder) {
          throw new Error(`Stakeholder ${es.departmentId} not found`);
        }
        
        // Fetch tasks for this event stakeholder
        const tasksList = await taskRepo.getTasksByEventDepartment(es.id);
        
        return {
          ...es,
          stakeholder: {
            id: stakeholder.id,
            name: stakeholder.name,
            nameAr: stakeholder.nameAr,
            keycloakGroupId: stakeholder.keycloakGroupId,
            active: stakeholder.active,
            ccList: stakeholder.ccList,
            createdAt: stakeholder.createdAt,
          },
          emails: stakeholder.emails,
          requirements: stakeholder.requirements,
          tasks: tasksList,
        };
      })
    );
    
    return result;
  }

  async getEventsByDepartment(departmentId: number): Promise<Event[]> {
    const eventStakeholderRecords = await this.db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.departmentId, departmentId));
    
    const eventIds = eventStakeholderRecords.map(es => es.eventId);
    if (eventIds.length === 0) {
      return [];
    }
    
    const eventRecords = await this.db
      .select()
      .from(events)
      .where(inArray(events.id, eventIds))
      .orderBy(events.startDate);
    
    return eventRecords;
  }

  async isDepartmentAssignedToEvent(departmentId: number, eventId: string): Promise<boolean> {
    const [assignment] = await this.db
      .select()
      .from(eventDepartments)
      .where(
        and(
          eq(eventDepartments.departmentId, departmentId),
          eq(eventDepartments.eventId, eventId)
        )
      );
    return !!assignment;
  }

  async getEventDepartmentsByDepartmentId(eventId: string, departmentId: number): Promise<Array<EventDepartment & { stakeholder: Department, emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>> {
    const eventStakeholderRecords = await this.db
      .select()
      .from(eventDepartments)
      .where(
        and(
          eq(eventDepartments.eventId, eventId),
          eq(eventDepartments.departmentId, departmentId)
        )
      );
    
    const result = await Promise.all(
      eventStakeholderRecords.map(async (es) => {
        const stakeholder = await this.getDepartment(es.departmentId);
        if (!stakeholder) {
          throw new Error(`Stakeholder ${es.departmentId} not found`);
        }
        return {
          ...es,
          stakeholder: {
            id: stakeholder.id,
            name: stakeholder.name,
            nameAr: stakeholder.nameAr,
            keycloakGroupId: stakeholder.keycloakGroupId,
            active: stakeholder.active,
            ccList: stakeholder.ccList,
            createdAt: stakeholder.createdAt,
          },
          emails: stakeholder.emails,
          requirements: stakeholder.requirements,
        };
      })
    );
    
    return result;
  }

  async getEventDepartment(eventDepartmentId: number): Promise<EventDepartment | undefined> {
    const [eventStakeholder] = await this.db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.id, eventDepartmentId));
    return eventStakeholder || undefined;
  }

  async updateEventDepartmentLastReminder(id: number): Promise<void> {
    await this.db
      .update(eventDepartments)
      .set({ lastReminderSentAt: new Date() })
      .where(eq(eventDepartments.id, id));
  }

  // Department Account operations
  async getDepartmentAccountByUserId(userId: number): Promise<DepartmentAccount | undefined> {
    const [account] = await this.db
      .select()
      .from(departmentAccounts)
      .where(eq(departmentAccounts.userId, userId));
    return account || undefined;
  }

  async updateDepartmentAccountLastLogin(userId: number): Promise<void> {
    await this.db
      .update(departmentAccounts)
      .set({ lastLoginAt: new Date() })
      .where(eq(departmentAccounts.userId, userId));
  }

  async getAllDepartmentAccounts(): Promise<Array<DepartmentAccount & { departmentName: string, username: string, primaryEmail: string }>> {
    const results = await this.db
      .select({
        id: departmentAccounts.id,
        userId: departmentAccounts.userId,
        departmentId: departmentAccounts.departmentId,
        primaryEmailId: departmentAccounts.primaryEmailId,
        lastLoginAt: departmentAccounts.lastLoginAt,
        createdAt: departmentAccounts.createdAt,
        departmentName: departments.name,
        username: users.username,
        primaryEmail: departmentEmails.email,
      })
      .from(departmentAccounts)
      .innerJoin(departments, eq(departmentAccounts.departmentId, departments.id))
      .innerJoin(users, eq(departmentAccounts.userId, users.id))
      .innerJoin(departmentEmails, eq(departmentAccounts.primaryEmailId, departmentEmails.id))
      .orderBy(departments.name);
    
    return results;
  }

  async getDepartmentAccountByDepartmentId(departmentId: number): Promise<DepartmentAccount | undefined> {
    const [account] = await this.db
      .select()
      .from(departmentAccounts)
      .where(eq(departmentAccounts.departmentId, departmentId));
    return account || undefined;
  }

  async createDepartmentAccount(data: InsertDepartmentAccount): Promise<DepartmentAccount> {
    const [account] = await this.db
      .insert(departmentAccounts)
      .values(data)
      .returning();
    return account;
  }

  async deleteDepartmentAccount(id: number): Promise<boolean> {
    const result = await this.db
      .delete(departmentAccounts)
      .where(eq(departmentAccounts.id, id))
      .returning();
    return result.length > 0;
  }

  async createAuthIdentity(data: InsertAuthIdentity): Promise<AuthIdentity> {
    const [identity] = await this.db
      .insert(authIdentities)
      .values(data)
      .returning();
    return identity;
  }

  // Keycloak-related department operations
  async getDepartmentByKeycloakGroupId(keycloakGroupId: string): Promise<Department | undefined> {
    const [department] = await this.db
      .select()
      .from(departments)
      .where(eq(departments.keycloakGroupId, keycloakGroupId))
      .limit(1);
    return department;
  }

  async getOrCreateDepartmentByName(name: string, keycloakGroupId?: string): Promise<Department> {
    // First, try to find by Keycloak group ID if provided
    if (keycloakGroupId) {
      const [existingByGroupId] = await this.db
        .select()
        .from(departments)
        .where(eq(departments.keycloakGroupId, keycloakGroupId))
        .limit(1);
      
      if (existingByGroupId) {
        return existingByGroupId;
      }
    }
    
    // Try to find by name
    const [existingByName] = await this.db
      .select()
      .from(departments)
      .where(eq(departments.name, name))
      .limit(1);
    
    if (existingByName) {
      // Update Keycloak group ID if provided and not set
      if (keycloakGroupId && !existingByName.keycloakGroupId) {
        const [updated] = await this.db
          .update(departments)
          .set({ keycloakGroupId })
          .where(eq(departments.id, existingByName.id))
          .returning();
        return updated;
      }
      return existingByName;
    }

    // Create new department with placeholder name
    const [created] = await this.db
      .insert(departments)
      .values({ 
        name: name,
        keycloakGroupId,
        nameAr: null,
      })
      .returning();
    
    console.log(`[DepartmentRepository] Created department placeholder: ${name} (Keycloak group: ${keycloakGroupId})`);
    return created;
  }

  async linkUserToDepartment(userId: number, departmentId: number, primaryEmailId: number): Promise<DepartmentAccount> {
    const [account] = await this.db
      .insert(departmentAccounts)
      .values({ userId, departmentId, primaryEmailId })
      .returning();
    return account;
  }

  async getUserDepartments(userId: number): Promise<Department[]> {
    const result = await this.db
      .select({ department: departments })
      .from(departments)
      .innerJoin(departmentAccounts, eq(departments.id, departmentAccounts.departmentId))
      .where(eq(departmentAccounts.userId, userId));
    
    return result.map(r => r.department);
  }
}
