/**
 * YOZGO Gamifikatsiya — Badge xizmati (Feature 3).
 *
 * evaluateBadges har natija/streak/battle'dan keyin chaqiriladi (fire-and-forget).
 * Idempotent: user_badges'dagi UNIQUE(user_id,badge_id) tufayli bir badge ikki marta
 * berilmaydi (concurrent solo+battle'da ham DB constraint himoya qiladi).
 *
 * DIQQAT: badge-context storage.getUserStats'ni CHAQIRMAYDI — u SELECT * bilan barcha
 * rowlarni JS'da yig'adi (O(n)). O'rniga yengil SQL agregat (count + max) ishlatiladi.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { getUserBot } from "../userBot";
import { BADGE_DEFINITIONS, type BadgeContext } from "./badge-defs";

/** Badge katalogini idempotent seed qiladi (index.ts startup'da). */
export async function seedBadges(): Promise<void> {
  for (const def of BADGE_DEFINITIONS) {
    await db.execute(sql`
      INSERT INTO badges (key, icon, sort_order)
      VALUES (${def.key}, ${def.icon}, ${def.sortOrder})
      ON CONFLICT (key) DO UPDATE SET icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order
    `);
  }
}

/** Yengil agregat orqali BadgeContext quradi (getUserStats EMAS). */
async function loadContext(
  userId: string,
  extra: Partial<BadgeContext>,
): Promise<BadgeContext> {
  const agg: any = await db.execute(sql`
    SELECT count(*)::int AS total_tests, COALESCE(max(wpm), 0)::int AS best_wpm
    FROM test_results WHERE user_id = ${userId}
  `);
  const row = agg.rows?.[0] ?? {};
  // Battle g'alabalari soni (Feature 10 badge'lari uchun) — yengil count.
  const winAgg: any = await db.execute(sql`
    SELECT count(*)::int AS wins FROM battle_participants
    WHERE user_id = ${userId} AND is_winner = true
  `);
  const [u] = await db
    .select({ xp: users.xp, streak: users.currentStreak })
    .from(users)
    .where(eq(users.id, userId));

  return {
    totalTests: Number(row.total_tests ?? 0),
    bestWpm: Number(row.best_wpm ?? 0),
    streak: u?.streak ?? 0,
    xp: u?.xp ?? 0,
    battleWins: Number(winAgg.rows?.[0]?.wins ?? 0),
    ...extra,
  };
}

/**
 * Yangi ochilgan badge'larni topadi, yozadi (ON CONFLICT DO NOTHING) va yangilarini
 * qaytaradi. Butunlay best-effort — hech qachon throw qilmaydi (natija saqlashni buzmasin).
 */
export async function evaluateBadges(
  userId: string,
  extra: Partial<BadgeContext> = {},
): Promise<string[]> {
  try {
    const ctx = await loadContext(userId, extra);

    const earnedRes: any = await db.execute(sql`
      SELECT b.key FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = ${userId}
    `);
    const earnedKeys = new Set<string>((earnedRes.rows ?? []).map((r: any) => r.key));

    const newlyEarned: string[] = [];
    for (const def of BADGE_DEFINITIONS) {
      if (earnedKeys.has(def.key)) continue;
      if (!def.predicate(ctx)) continue;
      const ins: any = await db.execute(sql`
        INSERT INTO user_badges (user_id, badge_id)
        SELECT ${userId}, b.id FROM badges b WHERE b.key = ${def.key}
        ON CONFLICT (user_id, badge_id) DO NOTHING
        RETURNING id
      `);
      if ((ins.rows ?? []).length > 0) newlyEarned.push(def.key);
    }

    if (newlyEarned.length > 0) {
      notifyBadges(userId, newlyEarned).catch(() => {});
    }
    return newlyEarned;
  } catch (e) {
    console.error("[BADGE] evaluateBadges xatosi:", e);
    return [];
  }
}

/** Yangi badge haqida Telegram xabar (best-effort). */
async function notifyBadges(userId: string, keys: string[]): Promise<void> {
  const bot = getUserBot();
  if (!bot) return;
  const [u] = await db
    .select({ telegramId: users.telegramId })
    .from(users)
    .where(eq(users.id, userId));
  if (!u?.telegramId) return;
  try {
    await bot.sendMessage(
      Number(u.telegramId),
      `🏅 Tabriklaymiz! Yangi yutuq ochding: ${keys.length} ta badge. Profilingda ko'r!`,
    );
  } catch {
    /* jim o'tkazamiz */
  }
}
