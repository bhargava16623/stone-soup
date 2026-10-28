import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env itself; on Render the variables are already set.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
