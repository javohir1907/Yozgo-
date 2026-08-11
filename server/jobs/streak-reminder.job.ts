/**
 * YOZGO Gamifikatsiya — Streak eslatma cron'i (Feature 2).
 *
 * Har kuni 19:00 Asia/Tashkent'da streaki xavf ostidagilarga (kecha faol bo'lgan,
 * lekin bugun hali test yozmagan) Telegram orqali eslatma yuboradi.
 *
 * DIQQAT: bu job faqat NODE_ENV=production VA RUN_CRON=true bo'lgan BITTA instance'da
 * ishga tushiriladi (index.ts'da gate qilingan) — dev'da yoki har Render instance'da
 * dublikat xabar bo'lmasin.
 */
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { getUserBot } from "../userBot";
import { processInChunks } from "../utils/async-chunker";
import { logger } from "../utils/logger";

/** Streak eslatma ishi (cron callback'dan ajratildi — qo'lda ham chaqirsa bo'ladi). */
export async function runStreakReminder(): Promise<{ notified: number }> {
  const bot = getUserBot();
  if (!bot) {
    logger.info("[CRON] streak-reminder: bot ulanmagan — o'tkazildi.", { source: "cron" });
    return { notified: 0 };
  }
  try {
    const res: any = await db.execute(sql`
      SELECT
        u.telegram_id,
        u.current_streak,
        u.longest_streak,
        COALESCE((SELECT MAX(wpm) FROM test_results tr WHERE tr.user_id = u.id), 0) AS best_wpm
      FROM users u
      WHERE u.telegram_id IS NOT NULL
        AND u.is_banned = false
        AND u.current_streak >= 1
        AND u.last_active_date = ((now() AT TIME ZONE 'Asia/Tashkent')::date - 1)
    `);
    const rows = res.rows ?? [];
    logger.info(`[CRON] streak-reminder: ${rows.length} ta foydalanuvchiga eslatma`, {
      source: "cron",
    });
    await processInChunks(rows, 50, 1000, async (u: any) => {
      try {
        // Yumshoq, "siz" ohangida — buyruq emas, taklif. Eski rekordlar (eng uzun
        // seriya, eng yaxshi WPM) bo'lsa eslatib, shaxsiylashtiradi.
        const records: string[] = [];
        if (u.longest_streak && u.longest_streak > u.current_streak) {
          records.push(`eng uzun seriyangiz — ${u.longest_streak} kun`);
        }
        if (u.best_wpm && u.best_wpm > 0) {
          records.push(`eng yaxshi natijangiz — ${u.best_wpm} WPM`);
        }
        const recordLine = records.length ? ` Sizning rekordlaringiz: ${records.join(", ")}.` : "";
        await bot.sendMessage(
          u.telegram_id as number,
          `👋 Sizda hozir ${u.current_streak} kunlik seriya bor.${recordLine} ` +
            `Xohlasangiz, bugun ham bitta test yozib, seriyangizni davom ettirishingiz mumkin.`,
        );
      } catch {
        /* bitta foydalanuvchiga yuborilmasa — davom etamiz */
      }
    });
    return { notified: rows.length };
  } catch (e) {
    logger.error("[CRON] streak-reminder xatosi:", e);
    return { notified: 0 };
  }
}

export function startStreakReminderJob() {
  cron.schedule("0 19 * * *", () => void runStreakReminder(), { timezone: "Asia/Tashkent" });
  logger.info("[CRON] streak-reminder ro'yxatga olindi (19:00 Asia/Tashkent).", {
    source: "cron",
  });
}
