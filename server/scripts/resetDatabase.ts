import "../config/loadEnv";
import { Client } from "pg";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const log = (message: string) => console.log(`[db:reset] ${message}`);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set before running db:reset");
}

const schemasFromEnv = process.env.DB_RESET_SCHEMAS ?? "public";
const schemasToReset = schemasFromEnv
  .split(",")
  .map((schema) => schema.trim())
  .filter(Boolean);

const quoteIdent = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

const pgUrl = new URL(connectionString);
const dbUser = decodeURIComponent(pgUrl.username || "postgres");

async function resetSchemas(client: Client) {
  for (const schema of schemasToReset) {
    log(`Dropping schema ${schema}…`);
    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE;`);
    log(`Recreating schema ${schema}…`);
    await client.query(`CREATE SCHEMA ${quoteIdent(schema)};`);

    if (schema === "public") {
      await client.query(`GRANT ALL ON SCHEMA public TO ${quoteIdent(dbUser)};`);
      await client.query(`GRANT ALL ON SCHEMA public TO public;`);
      await client.query(`COMMENT ON SCHEMA public IS 'Reset on ${new Date().toISOString()}';`);
    }

    if (schema === "keycloak") {
      const initPath = path.resolve(process.cwd(), "init-keycloak-schema.sql");
      if (fs.existsSync(initPath)) {
        log("Re-applying init-keycloak-schema.sql…");
        const initSql = fs.readFileSync(initPath, "utf8");
        if (initSql.trim()) {
          await client.query(initSql);
        }
      }
    }
  }
}

async function runDrizzleMigrations() {
  log("Running drizzle-kit push…");
  const bin = process.platform === "win32" ? "npx.cmd" : "npx";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, ["drizzle-kit", "push"], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`drizzle-kit push exited with code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

async function main() {
  log(`Connecting with user ${dbUser}…`);
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await resetSchemas(client);
  } finally {
    await client.end();
  }

  await runDrizzleMigrations();
  log("Database reset complete ✔");
}

main().catch((err) => {
  console.error("[db:reset]", err);
  process.exitCode = 1;
});
