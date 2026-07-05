import { db } from "../db";
import { testResults, users } from "@shared/schema";
import { eq, sql, desc, and, gte, inArray } from "drizzle-orm";

export type LeaderboardPeriod = "weekly" | "monthly" | "all";

// Asia/Tashkent (UTC+5, DST yo'q) hafta/oy chegaralarini UTC instant sifatida qaytaradi.
// created_at UTC saqlanadi (server UTC), shuning uchun Tashkent dushanba 00:00 =
// yakshanba 19:00 UTC. Fixed +5 offset (DST yo'q) — date-fns tz tuzog'idan xoli.
const TASHKENT_OFFSET_MS = 5 * 3600 * 1000;

function tashkentWeekStartUtc(): Date {
  const tash = new Date(Date.now() + TASHKENT_OFFSET_MS); // Tashkent devor-soati
  const day = tash.getUTCDay(); // 0=Yak..6=Shan
  const diffToMonday = (day + 6) % 7; // dushanbadan beri kunlar
  const mondayTash = Date.UTC(
    tash.getUTCFullYear(),
    tash.getUTCMonth(),
    tash.getUTCDate() - diffToMonday,
    0,
    0,
    0,
  );
  return new Date(mondayTash - TASHKENT_OFFSET_MS); // haqiqiy UTC instant
}

function tashkentMonthStartUtc(): Date {
  const tash = new Date(Date.now() + TASHKENT_OFFSET_MS);
  const firstTash = Date.UTC(tash.getUTCFullYear(), tash.getUTCMonth(), 1, 0, 0, 0);
  return new Date(firstTash - TASHKENT_OFFSET_MS);
}

export class LeaderboardService {
  /**
   * Peshqadamlar jadvalini hisoblaydi va qaytaradi.
   *
   * @param language til filtri
   * @param period   'weekly' (joriy Tashkent haftasi) | 'monthly' | 'all' (barcha vaqt)
   */
  static async getLeaderboardData(
    language: "all" | "en" | "ru" | "uz",
    period: LeaderboardPeriod = "all",
    friendIds?: string[],
  ) {
    // Faqat SOLO natijalar: battle natijalari (source='battle') global
    // leaderboard'ni ifloslantirmasligi kerak (foydalanuvchi qarori).
    const conds = [eq(testResults.source, "solo")];
    if (language !== "all") conds.push(eq(testResults.language, language));
    if (period === "weekly") conds.push(gte(testResults.createdAt, tashkentWeekStartUtc()));
    else if (period === "monthly") conds.push(gte(testResults.createdAt, tashkentMonthStartUtc()));
    // Friends mode (Feature 9 — Tier-1 seam): faqat do'stlar (+ o'zi, route qo'shadi).
    if (friendIds) {
      if (friendIds.length === 0) return []; // inArray([]) yaroqsiz SQL -> bo'sh qaytaramiz
      conds.push(inArray(testResults.userId, friendIds));
    }

    const leaderboardData = await db
      .select({
        userId: testResults.userId,
        username: users.firstName,
        email: users.email,
        avatarUrl: users.profileImageUrl,
        testCount: sql<number>`count(${testResults.id})::int`,
        bestWpm: sql<number>`max(${testResults.wpm})::int`,
        avgWpm: sql<number>`round(avg(${testResults.wpm}))::int`,
        accuracy: sql<number>`round(avg(${testResults.accuracy}))::int`,
        totalSeconds: sql<number>`sum(cast(${testResults.mode} as integer))::int`,
      })
      .from(testResults)
      .innerJoin(users, eq(testResults.userId, users.id))
      .where(and(...conds))
      .groupBy(testResults.userId, users.id, users.firstName, users.email, users.profileImageUrl)
      .orderBy(desc(sql`max(${testResults.wpm})`));

    return leaderboardData.map((user, index) => ({
      rank: index + 1,
      userId: user.userId,
      username: user.username || user.email?.split("@")[0] || "Unknown",
      avatarUrl: user.avatarUrl,
      avgWpm: user.avgWpm,
      bestWpm: user.bestWpm,
      accuracy: user.accuracy,
      testCount: user.testCount,
      totalSeconds: user.totalSeconds,
    }));
  }
}
