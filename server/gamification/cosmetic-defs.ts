/**
 * YOZGO Gamifikatsiya — Kosmetika katalogi (Feature 8), config-in-code.
 *
 * type: 'theme' (profil --primary accent), 'frame' (avatar ring), 'streak_freeze'
 * (iste'mol qilinadigan — 1 kun o'tkazishni yutadi). Titlelar client'da lokalizatsiya.
 * meta: theme -> { accent: "H S% L%" }, frame -> { ring: tailwind ring rang klassi }.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";

export interface CosmeticDef {
  key: string;
  type: "theme" | "frame" | "streak_freeze";
  price: number;
  meta: Record<string, unknown>;
  sortOrder: number;
}

export const COSMETIC_DEFINITIONS: CosmeticDef[] = [
  { key: "streak_freeze", type: "streak_freeze", price: 50, meta: {}, sortOrder: 0 },
  { key: "theme_ocean", type: "theme", price: 100, meta: { accent: "199 89% 48%" }, sortOrder: 10 },
  { key: "theme_forest", type: "theme", price: 100, meta: { accent: "142 71% 45%" }, sortOrder: 11 },
  { key: "theme_sunset", type: "theme", price: 150, meta: { accent: "20 90% 55%" }, sortOrder: 12 },
  // frame ring — HEX rang (inline style bilan qo'llanadi; Tailwind purge muammosi bo'lmasin).
  { key: "frame_gold", type: "frame", price: 200, meta: { ring: "#facc15" }, sortOrder: 20 },
  { key: "frame_neon", type: "frame", price: 200, meta: { ring: "#d946ef" }, sortOrder: 21 },
];

/** Kosmetika katalogini idempotent seed qiladi (index.ts startup'da). */
export async function seedCosmetics(): Promise<void> {
  for (const c of COSMETIC_DEFINITIONS) {
    await db.execute(sql`
      INSERT INTO cosmetics (key, type, price, meta, sort_order, is_active)
      VALUES (${c.key}, ${c.type}, ${c.price}, ${JSON.stringify(c.meta)}::jsonb, ${c.sortOrder}, true)
      ON CONFLICT (key) DO UPDATE SET type = EXCLUDED.type, price = EXCLUDED.price,
        meta = EXCLUDED.meta, sort_order = EXCLUDED.sort_order, is_active = true
    `);
  }
}

/** Berilgan theme/frame key uchun meta'ni topadi (profil ko'rsatish uchun). */
export function cosmeticMeta(key: string | null | undefined): Record<string, unknown> | null {
  if (!key) return null;
  const def = COSMETIC_DEFINITIONS.find((c) => c.key === key);
  return def ? def.meta : null;
}
