/**
 * YOZGO Gamifikatsiya — Kunlik streak (Feature 2).
 *
 * Kun chegarasi Asia/Tashkent (UTC+5, DST yo'q). Render UTC'da ishlagani uchun
 * "bugun" va saqlangan kun BIR XIL soatda — SQL'da `(now() AT TIME ZONE
 * 'Asia/Tashkent')::date` bilan — hisoblanadi (off-by-one bo'lmasin).
 *
 * Yagona ATOMIK `UPDATE ... CASE` (poyga-xavfsiz):
 *   - shu kun (last_active_date == bugun)      -> streak o'zgarmas (idempotent, bir kunda
 *                                                 bir necha test/battle -> bir marta sanaydi)
 *   - kecha (== bugun - 1)                      -> streak + 1
 *   - NULL yoki >= 2 kun tanaffus               -> reset -> 1 (joriy test kun 1 sifatida sanaladi)
 *   - banlangan (is_banned=true)                -> WHERE bilan o'tkazib yuboriladi (Rule 2)
 */
import { and, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "../db";
import { users } from "@shared/schema";
import { levelForXp } from "@shared/lib/xp";

// Asia/Tashkent kalendar kuni (SQL fragmenti — hamma joyda bir xil manba).
const TASHKENT_TODAY = sql`(now() AT TIME ZONE 'Asia/Tashkent')::date`;

// Yangi streak qiymatini hisoblaydigan CASE (current_streak va longest_streak uchun bir xil).
// Feature 8 streak-freeze: aynan 2 kunlik tanaffus (1 kun o'tkazilgan) VA freeze bo'lsa —
// streak saqlanadi (freeze bir kunni yutadi). Gap > 2 yoki freeze 0 -> reset 1.
const NEXT_STREAK = sql`CASE
    WHEN ${users.lastActiveDate} = ${TASHKENT_TODAY} THEN ${users.currentStreak}
    WHEN ${users.lastActiveDate} = ${TASHKENT_TODAY} - 1 THEN ${users.currentStreak} + 1
    WHEN ${users.lastActiveDate} = ${TASHKENT_TODAY} - 2 AND ${users.streakFreezes} > 0 THEN ${users.currentStreak}
    ELSE 1
  END`;

// Freeze faqat 2-kunlik tanaffus armida decrement bo'ladi (concurrent'da ham bir marta,
// chunki last_active_date shu UPDATE'da today'ga o'tadi -> keyingi natija qayta yoqmaydi).
const NEXT_FREEZES = sql`CASE
    WHEN ${users.lastActiveDate} = ${TASHKENT_TODAY} - 2 AND ${users.streakFreezes} > 0 THEN ${users.streakFreezes} - 1
    ELSE ${users.streakFreezes}
  END`;

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

export interface StreakXpResult extends StreakResult {
  xp: number;
  level: number;
}

/**
 * Streak'ni yangilaydi (XP'siz — battle yo'li uchun; battle XP alohida addUserXp
 * bilan hisoblanadi). Banlangan foydalanuvchiga ta'sir qilmaydi.
 */
export async function updateStreak(userId: string, executor: DbExecutor = db): Promise<StreakResult> {
  const res: any = await executor.execute(sql`
    UPDATE users SET
      current_streak = ${NEXT_STREAK},
      longest_streak = GREATEST(${users.longestStreak}, ${NEXT_STREAK}),
      streak_freezes = ${NEXT_FREEZES},
      last_active_date = ${TASHKENT_TODAY},
      updated_at = now()
    WHERE ${users.id} = ${userId} AND ${users.isBanned} = false
    RETURNING current_streak, longest_streak
  `);
  const row = res.rows?.[0];
  return {
    currentStreak: Number(row?.current_streak ?? 0),
    longestStreak: Number(row?.longest_streak ?? 0),
  };
}

/**
 * Streak + XP'ni BITTA atomik UPDATE'da yangilaydi (solo yo'li) — ikki round-trip
 * va poyga bo'lmasin. Level xp.ts (yagona manba) bilan qayta hisoblanadi va
 * `WHERE xp = newXp` guard bilan yoziladi (concurrent XP eventlarida stale level yozilmaydi).
 */
export async function updateStreakAndXp(
  userId: string,
  xpDelta: number,
  executor: DbExecutor = db,
): Promise<StreakXpResult> {
  const delta = Number.isFinite(xpDelta) && xpDelta > 0 ? Math.round(xpDelta) : 0;

  const res: any = await executor.execute(sql`
    UPDATE users SET
      current_streak = ${NEXT_STREAK},
      longest_streak = GREATEST(${users.longestStreak}, ${NEXT_STREAK}),
      streak_freezes = ${NEXT_FREEZES},
      last_active_date = ${TASHKENT_TODAY},
      xp = ${users.xp} + ${delta},
      updated_at = now()
    WHERE ${users.id} = ${userId} AND ${users.isBanned} = false
    RETURNING xp, current_streak, longest_streak
  `);

  const row = res.rows?.[0];
  if (!row) {
    // Banlangan yoki topilmadi — o'zgarish yo'q, joriy holatni qaytaramiz.
    const [u] = await executor
      .select({
        xp: users.xp,
        level: users.level,
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
      })
      .from(users)
      .where(eq(users.id, userId));
    return {
      xp: u?.xp ?? 0,
      level: u?.level ?? 1,
      currentStreak: u?.currentStreak ?? 0,
      longestStreak: u?.longestStreak ?? 0,
    };
  }

  const newXp = Number(row.xp);
  const newLevel = levelForXp(newXp);
  await executor
    .update(users)
    .set({ level: newLevel })
    .where(and(eq(users.id, userId), eq(users.xp, newXp)));

  return {
    xp: newXp,
    level: newLevel,
    currentStreak: Number(row.current_streak),
    longestStreak: Number(row.longest_streak),
  };
}
