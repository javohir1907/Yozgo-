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
      SELECT telegram_id, current_streak FROM users
      WHERE telegram_id IS NOT NULL
        AND is_banned = false
        AND current_streak >= 1
        AND last_active_date = ((now() AT TIME ZONE 'Asia/Tashkent')::date - 1)
    `);
    const rows = res.rows ?? [];
    logger.info(`[CRON] streak-reminder: ${rows.length} ta foydalanuvchiga eslatma`, {
      source: "cron",
    });
    await processInChunks(rows, 50, 1000, async (u: any) => {
      try {
        await bot.sendMessage(
          u.telegram_id as number,
          `🔥 Streaking yonib ketmasin! Hozir ${u.current_streak} kunlik seriyang bor — ` +
            `bugun 1 ta test yozib, seriyani saqlab qol!`,
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
