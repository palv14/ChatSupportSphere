import { defineConfig } from "drizzle-kit";

// Temporarily comment out DATABASE_URL requirement since we're using in-memory storage
// if (!process.env.DATABASE_URL) {
//   throw new Error("DATABASE_URL, ensure the database is provisioned");
// }

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy",
  },
});
