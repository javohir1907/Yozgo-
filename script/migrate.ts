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

    try {
      console.log("Setting 'javohir1907' as admin with secure email match...");
      await pool.query(`
      UPDATE users SET role = 'admin' WHERE username = 'javohir1907' AND email = 'xolmatovjavohir911@gmail.com';
      `);
    } catch (e) {
      console.log("Could not update via 'username' (column might still be 'first_name'), ignoring to prevent crash...");
    }

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

    CREATE TABLE IF NOT EXISTS test_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id),
      wpm integer NOT NULL,
      accuracy integer NOT NULL,
      language text NOT NULL,
      mode text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar REFERENCES users(id) NOT NULL,
      wpm integer NOT NULL,
      accuracy integer NOT NULL,
      language text NOT NULL,
      period text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS battles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      status text NOT NULL,
      language text NOT NULL,
      mode text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS battle_participants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      battle_id uuid REFERENCES battles(id) NOT NULL,
      user_id varchar REFERENCES users(id) NOT NULL,
      wpm integer,
      accuracy integer,
      is_winner boolean DEFAULT false,
      ip_address varchar,
      agreed_at timestamp,
      joined_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS room_access_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id uuid REFERENCES battles(id) NOT NULL,
      user_id varchar REFERENCES users(id),
      code text NOT NULL UNIQUE,
      is_used boolean DEFAULT false,
      used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );
    `);

    console.log("Tables verify/create completed!");
    process.exit(0);
}

createTables().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
