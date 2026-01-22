import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

if (process.env.__ENV_LOADER_INITIALIZED !== "true") {
  const cwd = process.cwd();
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const explicitEnvFile = process.env.ENV_FILE;

  const candidateFiles = explicitEnvFile
    ? [explicitEnvFile]
    : [
        ".env",
        ".env.local",
        `.env.${nodeEnv}`,
        `.env.${nodeEnv}.local`
      ];

  const loadedFiles: string[] = [];

  for (const file of candidateFiles) {
    const resolvedPath = path.isAbsolute(file) ? file : path.resolve(cwd, file);
    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    config({ path: resolvedPath, override: true });
    loadedFiles.push(resolvedPath);
  }

  if (!loadedFiles.length) {
    // Fallback to default dotenv behaviour so process.env stays untouched if no files exist
    config();
  }

  if (process.env.DEBUG_ENV_LOAD === "true") {
    console.log(`[env] Loaded: ${loadedFiles.join(", ") || "process environment only"}`);
  }

  process.env.__ENV_LOADER_INITIALIZED = "true";
}
