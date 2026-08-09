import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, which normally loads .env for us.
process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
