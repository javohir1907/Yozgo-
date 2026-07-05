import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// Production TLS konfiguratsiyasi:
// - DB_CA_CERT (PEM matni) berilsa: qat'iy tekshiruv (rejectUnauthorized: true) — TAVSIYA ETILADI.
// - berilmasa: self-signed sertifikat bilan ishlash uchun tekshiruv o'chiriladi
//   (hozirgi xatti-harakat saqlanadi, sayt uzilmaydi), lekin OGOHLANTIRISH chiqadi.
function buildSslConfig(): pg.PoolConfig["ssl"] {
  if (process.env.NODE_ENV !== "production") return undefined;
  const ca = process.env.DB_CA_CERT;
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }
  console.warn(
    "[DB] OGOHLANTIRISH: TLS sertifikat tekshiruvi O'CHIRILGAN (DB_CA_CERT berilmagan). " +
      "MITM xavfini yopish uchun production'da DB_CA_CERT (CA sertifikat PEM) qo'shing."
  );
  return { rejectUnauthorized: false };
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client", err);
});

export const db = drizzle(pool, { schema });
