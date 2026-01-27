/**
 * Auth Repository (MSSQL version)
 * Handles Keycloak authentication and user-related operations
 */
import { BaseRepository } from './base';
import { 
  users, departments, departmentAccounts, 
  type User 
} from '@shared/schema.mssql';
import { eq } from 'drizzle-orm';

export class AuthRepository extends BaseRepository {

  /**
   * Get user by Keycloak ID
   */
  async getUserByKeycloakId(keycloakId: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.keycloakId, keycloakId))
      .limit(1);

    return user;
  }

  /**
   * Create user from Keycloak authentication
   */
  async createUserFromKeycloak(data: {
    username: string;
    email: string;
    keycloakId: string;
    role: 'superadmin' | 'admin' | 'department' | 'department_admin';
  }): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        keycloakId: data.keycloakId,
        role: data.role,
        password: null, // Keycloak-only users don't need local password
      })
      .returning(); // INSERT returning works in MSSQL

    return user;
  }

  /**
   * Update user from Keycloak (sync role, email, and Keycloak ID changes)
   */
  async updateUserFromKeycloak(
    userId: number,
    data: { 
      role?: 'superadmin' | 'admin' | 'department' | 'department_admin'; 
      email?: string; 
      keycloakId?: string 
    }
  ): Promise<User> {

    // MSSQL: update() cannot return updated rows
    await this.db
      .update(users)
      .set(data)
      .where(eq(users.id, userId));

    // Fetch updated user
    const [updated] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return updated!;
  }

  /**
   * Get all users belonging to a specific department (by department name/Keycloak group)
   */
  async getUsersByDepartmentName(departmentName: string): Promise<User[]> {
    const result = await this.db
      .select({ user: users })
      .from(users)
      .innerJoin(departmentAccounts, eq(users.id, departmentAccounts.userId))
      .innerJoin(departments, eq(departmentAccounts.departmentId, departments.id))
      .where(eq(departments.name, departmentName));

    return result.map((r: { user: any; }) => r.user);
  }
}
