/**
 * User Repository
 * Handles all user-related database operations
 */
import { BaseRepository } from './base';
import { users, type User, type InsertUser } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class UserRepository extends BaseRepository {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users).orderBy(users.createdAt);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await this.db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async updateUserRole(id: number, role: 'admin' | 'superadmin' | 'department' | 'department_admin'): Promise<void> {
    await this.db
      .update(users)
      .set({ role })
      .where(eq(users.id, id));
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  }
}
