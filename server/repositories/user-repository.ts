/**
 * User Repository (MSSQL version)
 * Handles all user-related database operations
 */
import { BaseRepository } from "./base";
import { users, type User, type InsertUser } from "@shared/schema.mssql";
import { eq } from "drizzle-orm";

export class UserRepository extends BaseRepository {

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id));

    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));

    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .orderBy(users.createdAt);
  }

  /**
   * MSSQL-safe create:
   * - No `.returning()`
   * - Insert, then re-select by unique username
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    await this.db.insert(users).values(insertUser);

    const created = await this.getUserByUsername(insertUser.username);
    if (!created) {
      throw new Error("User was created but could not be reloaded from DB.");
    }

    return created;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await this.db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async updateUserRole(
    id: number,
    role: "admin" | "superadmin" | "department" | "department_admin" | "staff" | "event_lead" | "viewer"
  ): Promise<void> {
    await this.db
      .update(users)
      .set({ role })
      .where(eq(users.id, id));
  }

  /**
   * MSSQL-safe delete:
   * - No `.returning()`
   * - Use rowsAffected when available
   * - Fallback to existence check
   */
  async deleteUser(id: number): Promise<boolean> {
    const res: any = await this.db
      .delete(users)
      .where(eq(users.id, id));

    const rowsAffected =
      Array.isArray(res?.rowsAffected) ? res.rowsAffected[0] : res?.rowsAffected;

    if (typeof rowsAffected === "number") {
      return rowsAffected > 0;
    }

    // Fallback: verify deletion
    const stillExists = await this.getUser(id);
    return !stillExists;
  }
}
