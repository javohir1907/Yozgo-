/**
 * YOZGO Gamifikatsiya — Haftalik rollover cron'i (Feature 4).
 *
 * Dushanba 00:00 Asia/Tashkent — YAGONA haftalik chegara (Contract B). Hozircha
 * o'tgan haftaning leaderboard g'olibini (weekly WPM) userBot orqali e'lon qiladi.
 * Tier 2 Ligalar qo'shilganda shu JOB liga reset'ini ham bajaradi (bir joyda,
 * yagona chegara — Yakshanba-20:00 ↔ Dushanba-00:00 bo'shlig'i bo'lmasin).
 *
 * DIQQAT: faqat NODE_ENV=production VA RUN_CRON=true bo'lgan BITTA instance'da.
 */
import cron from "node-cron";
import { LeaderboardService } from "../services/leaderboard.service";
import { leagueWeeklyReset } from "../services/league.service";
import { broadcastFromUserBot } from "../userBot";
import { logger } from "../utils/logger";

// Haftalik board uchun malakaviy chegara (client bilan bir xil: 300s = 5 daqiqa).
const WEEKLY_MIN_SECONDS = 300;

/**
 * Haftalik rollover ishi (cron callback'dan ajratildi — qo'lda ham chaqirsa bo'ladi):
 * (1) o'tgan haftaning leaderboard WPM g'olibini e'lon qiladi, (2) liga reset (Contract B).
 */
export async function runWeeklyRollover(): Promise<{ winner: string | null; leagueProcessed: number; leagueSkipped: boolean }> {
  let winnerName: string | null = null;
  try {
    const entries = await LeaderboardService.getLeaderboardData("all", "weekly");
    const winner = entries.find((e) => e.totalSeconds >= WEEKLY_MIN_SECONDS);
    if (winner) {
      winnerName = winner.username;
      const text =
        `🏆 O'tgan haftaning eng tez terma-yozuvchisi: ${winner.username} — ${winner.bestWpm} WPM!\n` +
        `Tabriklaymiz! 🎉 Bu hafta sen ham cho'qqiga chiqishga urinib ko'r! 🚀`;
      const result = await broadcastFromUserBot(text);
      logger.info(`[CRON] weekly-rollover e'lon qilindi: ${result.text}`, { source: "cron" });
    } else {
      logger.info("[CRON] weekly-rollover: yaroqli g'olib topilmadi.", { source: "cron" });
    }

    // Liga haftalik reset (Feature 5) — SHU yagona dushanba-00:00 job'da (Contract B).
    const league = await leagueWeeklyReset();
    logger.info(
      `[CRON] league reset: ${league.skipped ? "skip (allaqachon)" : league.processed + " a'zo"}`,
      { source: "cron" },
    );
    return { winner: winnerName, leagueProcessed: league.processed, leagueSkipped: league.skipped };
  } catch (e) {
    logger.error("[CRON] weekly-rollover xatosi:", e);
    return { winner: winnerName, leagueProcessed: 0, leagueSkipped: false };
  }
}

export function startWeeklyRolloverJob() {
  cron.schedule("0 0 * * 1", () => void runWeeklyRollover(), { timezone: "Asia/Tashkent" });
  logger.info("[CRON] weekly-rollover ro'yxatga olindi (Dushanba 00:00 Asia/Tashkent).", {
    source: "cron",
  });
}
