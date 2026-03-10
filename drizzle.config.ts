import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is missing, skipping DB credentials");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
  },
});
