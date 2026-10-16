import { Pool, types } from "pg";
import { attachDatabasePool } from "@vercel/functions";

types.setTypeParser(20, Number);

let pool: Pool | undefined;

export function getPool() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured.");
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      application_name: "keylane",
    });
    pool.on("error", (error) =>
      console.error("Database connection failed:", error.message),
    );
    attachDatabasePool(pool);
  }
  return pool;
}
