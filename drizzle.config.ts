import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/schema.mssql.migrations.ts",
  out: "./migrations/mssql",
  dialect: "mssql",
  dbCredentials: {
    server: "mssql", //-- localhot for outside docker, mssql for inside docker
    port: Number(process.env.MSSQL_PORT) || 1433,
    user: process.env.MSSQL_USER || "sa",
    password: process.env.MSSQL_SA_PASSWORD || "eCSsr2o264@2026!",
    database: process.env.MSSQL_DB_NAME || "EMS",
    options: {
      trustServerCertificate: true,
    },
  },
});
