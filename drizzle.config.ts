import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const isDevelopment = process.env.NODE_ENV === "development" || 
                     process.env.DATABASE_URL?.includes("localhost") ||
                     process.env.DATABASE_URL?.includes("127.0.0.1");

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // In development, skip prompts for destructive operations
  strict: !isDevelopment,
  verbose: true,
});
