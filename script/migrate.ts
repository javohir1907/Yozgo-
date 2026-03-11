import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is missing, skipping table creation.");
    process.exit(0);
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool, { schema });

async function createTables() {
    console.log("Setting up tables if missing...");
    // Create sessions table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid varchar PRIMARY KEY,
      sess jsonb NOT NULL,
      expire timestamp NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire);
  `);

    // Create users table
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar UNIQUE NOT NULL,
      password varchar NOT NULL,
      first_name varchar,
      last_name varchar,
      profile_image_url varchar,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
  `);

    console.log("Tables verify/create completed!");
    process.exit(0);
}

createTables().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
