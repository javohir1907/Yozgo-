import { db } from "../db";
import { testResults, users } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";

export class LeaderboardService {
  /**
   * Peshqadamlar jadvalini hisoblaydi va qaytaradi.
   * Bu biznes mantiq routerdan ajratildi.
   */
  static async getLeaderboardData(language: "all" | "en" | "ru" | "uz") {
    // Faqat SOLO natijalar: battle natijalari (source='battle') global
    // leaderboard'ni ifloslantirmasligi kerak (foydalanuvchi qarori).
    const soloOnly = eq(testResults.source, "solo");
    const filterConditions =
      language !== "all" ? and(soloOnly, eq(testResults.language, language)) : soloOnly;

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
      .where(filterConditions)
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
