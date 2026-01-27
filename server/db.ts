
// Database integration with support for PostgreSQL (current) and MSSQL (Phase 2 readiness)
import * as schema from "@shared/schema.mssql";
import { drizzle } from "drizzle-orm/node-mssql";
// Dialect selector:
// - postgres (default): uses pg Pool + drizzle-orm/node-postgres
// - mssql: uses drizzle-orm/node-mssql (requires drizzle-orm@beta + mssql driver)
export type DbDialect = "mssql";
export const DB_DIALECT: DbDialect = (process.env.DB_DIALECT as DbDialect) || "mssql";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

type MsSqlClient = unknown;
export let mssqlClient: MsSqlClient | undefined;

export let db: any;
export let pool: any;

mssqlClient = process.env.DATABASE_URL;
db = drizzle(process.env.DATABASE_URL, { schema });
