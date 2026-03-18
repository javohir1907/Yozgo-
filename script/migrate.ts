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

    console.log("Adding and updating users schema for admin role if missing...");
    await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'user';
    `);

    console.log("Setting 'javohir1907' as admin with secure email match...");
    await pool.query(`
    UPDATE users SET role = 'admin' WHERE first_name = 'javohir1907' AND email = 'xolmatovjavohir911@gmail.com';
    `);

    console.log("Setting up new tables...");
    await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) NOT NULL,
      rating integer NOT NULL,
      comment text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS competitions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      prize text,
      date timestamp NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS advertisements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      image_url text NOT NULL,
      link_url text NOT NULL,
      start_date timestamp NOT NULL,
      end_date timestamp NOT NULL,
      is_active boolean DEFAULT true
    );
    `);

    console.log("Tables verify/create completed!");
    process.exit(0);
}

createTables().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
