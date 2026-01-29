import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, InsertUser } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export interface IAuthService {
  authenticate(username: string, password: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  hashPassword(password: string): Promise<string>;
  updateUserPassword(userId: number, newPassword: string): Promise<void>;
}

export class LocalAuthService implements IAuthService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  private async comparePasswords(supplied: string, stored: string): Promise<boolean> {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  }

  async authenticate(username: string, password: string): Promise<User | null> {
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return null;
    }
    
    // Check if user has a password
    if (!user.password) {
      console.log('[Auth] User has no password set:', username);
      return null;
    }
    
    if (!(await this.comparePasswords(password, user.password))) {
      return null;
    }
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await storage.getUserByUsername(username);
  }

  async createUser(data: InsertUser): Promise<User> {
    // Only hash password if provided (Keycloak users don't need passwords)
    const hashedPassword = data.password ? await this.hashPassword(data.password) : undefined;
    return await storage.createUser({
      ...data,
      password: hashedPassword,
    });
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);
    await storage.updateUserPassword(userId, hashedPassword);
  }
}

export class LDAPAuthService implements IAuthService {
  async authenticate(username: string, password: string): Promise<User | null> {
    throw new Error("LDAP authentication not yet implemented");
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    throw new Error("LDAP getUserByUsername not yet implemented");
  }

  async createUser(data: InsertUser): Promise<User> {
    throw new Error("LDAP createUser not yet implemented");
  }

  async hashPassword(password: string): Promise<string> {
    throw new Error("LDAP does not use local password hashing");
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    throw new Error("LDAP does not support password updates");
  }
}

export function getAuthService(): IAuthService {
  const authProvider = process.env.AUTH_PROVIDER || 'local';
  
  switch (authProvider) {
    case 'ldap':
      return new LDAPAuthService();
    case 'local':
    default:
      return new LocalAuthService();
  }
}
