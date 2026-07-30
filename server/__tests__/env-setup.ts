// Loads .env into process.env for the server test project. These are
// integration tests that talk to a real Postgres (register/cleanup), and
// server/db.ts throws at import time without DATABASE_URL — jest does not read
// .env on its own. No dotenv dependency; a tiny hand parser keeps it dep-free.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  /* no .env — CI without a DB will still skip/fail the integration tests */
}

// A dummy fallback so the db.ts guard does not throw at import even when .env
// is absent; the pg Pool connects lazily, so import stays side-effect-free.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://localhost:5432/yozgo_test";
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "test-secret";
}
