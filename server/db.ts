import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

let globalPool: Pool | undefined = (global as any).__dbPool;

if (!globalPool) {
  globalPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000, // <-- FIX
  });

  (global as any).__dbPool = globalPool;
}

export const pool = globalPool;
export const db = drizzle(pool, { schema });