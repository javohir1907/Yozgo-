import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// DB TLS konfiguratsiyasi (SSL OPT-IN — self-hosted Postgres uchun muhim):
// - DB_CA_CERT (PEM) berilsa       -> qat'iy tekshiruv (rejectUnauthorized: true). TAVSIYA.
// - DB_SSL=true YOKI URL'da sslmode=require|verify -> SSL, tekshiruvsiz (managed DB uchun).
// - aks holda (standart)           -> SSL YO'Q. Self-hosted (Coolify internal network) Postgres
//   odatda SSL'siz; SSL majburlansa "server does not support SSL connections" xatosi chiqadi.
function buildSslConfig(): pg.PoolConfig["ssl"] {
  const ca = process.env.DB_CA_CERT;
  if (ca) {
    return { ca, rejectUnauthorized: true };
  }
  const url = process.env.DATABASE_URL || "";
  const wantSsl = process.env.DB_SSL === "true" || /[?&]sslmode=(require|verify)/i.test(url);
  if (wantSsl) {
    console.warn(
      "[DB] OGOHLANTIRISH: SSL yoqilgan, lekin sertifikat tekshiruvi O'CHIRILGAN (DB_CA_CERT yo'q). " +
        "MITM xavfini yopish uchun DB_CA_CERT (CA PEM) qo'shing."
    );
    return { rejectUnauthorized: false };
  }
  return undefined; // SSL yo'q — self-hosted non-SSL Postgres bilan ishlaydi
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: buildSslConfig(),
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client", err);
});

export const db = drizzle(pool, { schema });

// `db` yoki transaction (tx) — reward funksiyalarini BITTA tranzaksiyada bajarish uchun
// (idempotent solo natija). Ikkalasi ham select/insert/update/execute ni qo'llab-quvvatlaydi.
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
