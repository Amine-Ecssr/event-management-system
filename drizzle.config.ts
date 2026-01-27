// import { defineConfig } from "drizzle-kit";

// if (!process.env.DATABASE_URL) {
//   throw new Error("DATABASE_URL, ensure the database is provisioned");
// }

// const isDevelopment = process.env.NODE_ENV === "development" || 
//                      process.env.DATABASE_URL?.includes("localhost") ||
//                      process.env.DATABASE_URL?.includes("127.0.0.1");

// export default defineConfig({
//   out: "./migrations",
//   schema: "./shared/schema.ts",
//   dialect: "postgresql",
//   dbCredentials: {
//     url: process.env.DATABASE_URL,
//   },
//   // In development, skip prompts for destructive operations
//   strict: !isDevelopment,
//   verbose: true,
// });


//######################### MIGRATION - PART A ##############################
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}
console.log("Loading db config ....");
console.log("Database URL: ", process.env.DATABASE_URL);
console.log("Database Dialect: ", process.env.DB_DIALECT);  
console.log("Is Development: ", process.env.NODE_ENV );
const isDevelopment = process.env.NODE_ENV === "development" || 
                     process.env.DATABASE_URL?.includes("localhost") ||
                     process.env.DATABASE_URL?.includes("127.0.0.1");

export default defineConfig({
  out: "./migrations-mssql",
  schema: "./shared/schema.mssql.migrations.ts",
  dialect: process.env.DB_DIALECT as "mssql" ?? 'mssql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // In development, skip prompts for destructive operations
  strict: !isDevelopment,
  verbose: true,
});
