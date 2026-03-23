import {
  User,
  TestResult,
  InsertTestResult,
  LeaderboardEntry,
  InsertLeaderboardEntry,
  Battle,
  InsertBattle,
  BattleParticipant,
  InsertBattleParticipant,
  users,
  testResults,
  leaderboardEntries,
  battles,
  battleParticipants,
  reviews,
  competitions,
  advertisements,
  Review,
  InsertReview,
  Competition,
  InsertCompetition,
  Advertisement,
  InsertAdvertisement,
} from "@shared/schema";
import { UpsertUser } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;

  // Test Results
  createTestResult(result: InsertTestResult): Promise<TestResult>;
  getTestResultsByUserId(userId: string): Promise<TestResult[]>;
  getUserStats(userId: string): Promise<{
    totalTests: number;
    avgWpm: number;
    bestWpm: number;
    avgAccuracy: number;
  }>;

  // Leaderboard
  getLeaderboard(period: string, language: string): Promise<(LeaderboardEntry & { user: User })[]>;
  updateLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;

  // Battles
  createBattle(battle: InsertBattle): Promise<Battle>;
  getBattleByCode(code: string): Promise<Battle | undefined>;
  updateBattleStatus(id: string, status: string): Promise<Battle>;

  // Battle Participants
  addBattleParticipant(participant: InsertBattleParticipant): Promise<BattleParticipant>;
  getBattleParticipants(battleId: string): Promise<(BattleParticipant & { user: User })[]>;
  updateBattleParticipant(id: string, data: Partial<BattleParticipant>): Promise<BattleParticipant>;

  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getRecentReviews(limit?: number): Promise<(Review & { user: User })[]>;

  // Competitions
  createCompetition(competition: InsertCompetition): Promise<Competition>;
  getActiveCompetitions(): Promise<Competition[]>;

  // Advertisements
  createAdvertisement(ad: InsertAdvertisement): Promise<Advertisement>;
  getActiveAdvertisements(): Promise<Advertisement[]>;
  getAllAdvertisements(): Promise<Advertisement[]>;
  toggleAdvertisement(id: string, isActive: boolean): Promise<Advertisement>;
  trackAdClick(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: The schema in models/auth uses 'email' instead of 'username' for Replit Auth
    // But common pattern is to use email as identifier.
    // If the task specifically asks for username, we might need to adjust.
    // However, Replit Auth usually provides email.
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createTestResult(result: InsertTestResult): Promise<TestResult> {
    const [testResult] = await db.insert(testResults).values(result).returning();
    return testResult;
  }

  async getTestResultsByUserId(userId: string): Promise<TestResult[]> {
    return db
      .select()
      .from(testResults)
      .where(eq(testResults.userId, userId))
      .orderBy(desc(testResults.createdAt));
  }

  async getUserStats(userId: string) {
    const results = await this.getTestResultsByUserId(userId);
    if (results.length === 0) {
      return { totalTests: 0, avgWpm: 0, bestWpm: 0, avgAccuracy: 0 };
    }

    const totalTests = results.length;
    const totalWpm = results.reduce((acc, r) => acc + r.wpm, 0);
    const bestWpm = Math.max(...results.map((r) => r.wpm));
    const totalAccuracy = results.reduce((acc, r) => acc + r.accuracy, 0);

    return {
      totalTests,
      avgWpm: Math.round(totalWpm / totalTests),
      bestWpm,
      avgAccuracy: Math.round(totalAccuracy / totalTests),
    };
  }

  async getLeaderboard(period: string, language: string) {
    const results = await db
      .select({
        entry: leaderboardEntries,
        user: users,
      })
      .from(leaderboardEntries)
      .innerJoin(users, eq(leaderboardEntries.userId, users.id))
      .where(and(eq(leaderboardEntries.period, period), eq(leaderboardEntries.language, language)))
      .orderBy(desc(leaderboardEntries.wpm));

    return results.map((r) => ({ ...r.entry, user: r.user }));
  }

  async updateLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const [existing] = await db
      .select()
      .from(leaderboardEntries)
      .where(
        and(
          eq(leaderboardEntries.userId, entry.userId),
          eq(leaderboardEntries.period, entry.period),
          eq(leaderboardEntries.language, entry.language)
        )
      );

    if (existing) {
      if (entry.wpm > existing.wpm) {
        const [updated] = await db
          .update(leaderboardEntries)
          .set({
            wpm: entry.wpm,
            accuracy: entry.accuracy,
            updatedAt: new Date(),
          })
          .where(eq(leaderboardEntries.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    } else {
      const [inserted] = await db.insert(leaderboardEntries).values(entry).returning();
      return inserted;
    }
  }

  async createBattle(battle: InsertBattle): Promise<Battle> {
    const [newBattle] = await db.insert(battles).values(battle).returning();
    return newBattle;
  }

  async getBattleByCode(code: string): Promise<Battle | undefined> {
    const [battle] = await db.select().from(battles).where(eq(battles.code, code));
    return battle;
  }

  async updateBattleStatus(id: string, status: string): Promise<Battle> {
    const [updated] = await db
      .update(battles)
      .set({ status })
      .where(eq(battles.id, id))
      .returning();
    return updated;
  }

  async addBattleParticipant(participant: InsertBattleParticipant): Promise<BattleParticipant> {
    const [newParticipant] = await db.insert(battleParticipants).values(participant).returning();
    return newParticipant;
  }

  async getBattleParticipants(battleId: string) {
    const results = await db
      .select({
        participant: battleParticipants,
        user: users,
      })
      .from(battleParticipants)
      .innerJoin(users, eq(battleParticipants.userId, users.id))
      .where(eq(battleParticipants.battleId, battleId));

    return results.map((r) => ({ ...r.participant, user: r.user }));
  }

  async updateBattleParticipant(
    id: string,
    data: Partial<BattleParticipant>
  ): Promise<BattleParticipant> {
    const [updated] = await db
      .update(battleParticipants)
      .set(data)
      .where(eq(battleParticipants.id, id))
      .returning();
    return updated;
  }

  // Reviews
  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async getRecentReviews(limitNum = 5) {
    const results = await db
      .select({
        review: reviews,
        user: users,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .orderBy(desc(reviews.createdAt))
      .limit(limitNum);

    return results.map((r) => ({ ...r.review, user: r.user }));
  }

  // Competitions
  async createCompetition(competition: InsertCompetition): Promise<Competition> {
    const [newComp] = await db.insert(competitions).values(competition).returning();
    return newComp;
  }

  async getActiveCompetitions(): Promise<Competition[]> {
    return db
      .select()
      .from(competitions)
      .where(eq(competitions.isActive, true))
      .orderBy(competitions.date);
  }

  // Advertisements
  async createAdvertisement(ad: InsertAdvertisement): Promise<Advertisement> {
    const [newAd] = await db.insert(advertisements).values(ad).returning();
    return newAd;
  }

  async getActiveAdvertisements(): Promise<Advertisement[]> {
    return db
      .select()
      .from(advertisements)
      .where(eq(advertisements.isActive, true))
      .orderBy(desc(advertisements.startDate));
  }

  async getAllAdvertisements(): Promise<Advertisement[]> {
    return db.select().from(advertisements).orderBy(desc(advertisements.id));
  }

  async toggleAdvertisement(id: string, isActive: boolean): Promise<Advertisement> {
    const [updated] = await db
      .update(advertisements)
      .set({ isActive })
      .where(eq(advertisements.id, id))
      .returning();
    return updated;
  }

  async trackAdClick(id: string): Promise<void> {
    const [ad] = await db.select().from(advertisements).where(eq(advertisements.id, id));
    if (ad) {
      await db
        .update(advertisements)
        .set({ clicks: (ad.clicks || 0) + 1 })
        .where(eq(advertisements.id, id));
    }
  }
}

export const storage = new DatabaseStorage();
