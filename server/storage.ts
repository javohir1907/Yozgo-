/**
 * YOZGO - Data Access Layer (Storage)
 * 
 * Ushbu modul platformaning barcha ma'lumotlar bazasi operatsiyalarini Repository
 * pattern asosida boshqaradi. Drizzle ORM yordamida PostgreSQL bilan aloqa qiladi.
 * 
 * @author YOZGO Team
 * @version 1.1.0
 */

// ============ IMPORTS ============
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
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

// ============ INTERFACES ============

/**
 * Storage interfeysi: testlash va boshqa implementatsiyalar uchun shablon sifatida xizmat qiladi.
 */
export interface IStorage {
  // User Management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;

  // Performance Tracking
  createTestResult(result: InsertTestResult): Promise<TestResult>;
  getTestResultsByUserId(userId: string): Promise<TestResult[]>;
  getUserStats(userId: string): Promise<UserStats>;

  // Competitive (Leaderboard)
  getLeaderboard(period: string, language: string): Promise<(LeaderboardEntry & { user: User })[]>;
  updateLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry>;

  // Battle Arena (Multiplayer)
  createBattle(battle: InsertBattle): Promise<Battle>;
  getBattleByCode(code: string): Promise<Battle | undefined>;
  updateBattleStatus(id: string, status: string): Promise<Battle>;
  addBattleParticipant(participant: InsertBattleParticipant): Promise<BattleParticipant>;
  getBattleParticipants(battleId: string): Promise<(BattleParticipant & { user: User })[]>;

  // Social & Marketing
  createReview(review: InsertReview): Promise<Review>;
  getActiveCompetitions(): Promise<Competition[]>;
  getActiveAdvertisements(): Promise<Advertisement[]>;
}

export type UserStats = {
  totalTests: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
};

// ============ IMPLEMENTATION ============

/**
 * PostgreSQL va Drizzle ORM bilan ishlaydigan asosiy Storage implementatsiyasi.
 */
export class DatabaseStorage implements IStorage {
  
  // ============ USER OPERATIONS ============

  /**
   * Foydalanuvchini ID orqali olish.
   */
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  /**
   * Foydalanuvchini email (yoki username) orqali olish.
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  /**
   * Yangi foydalanuvchi yaratish.
   */
  async createUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // ============ PERFORMANCE OPERATIONS ============

  /**
   * Test natijasini saqlash.
   */
  async createTestResult(result: InsertTestResult): Promise<TestResult> {
    const [testResult] = await db.insert(testResults).values(result).returning();
    return testResult;
  }

  /**
   * Foydalanuvchining barcha test natijalarini teskari xronologik tartibda olish.
   */
  async getTestResultsByUserId(userId: string): Promise<TestResult[]> {
    return db
      .select()
      .from(testResults)
      .where(eq(testResults.userId, userId))
      .orderBy(desc(testResults.createdAt));
  }

  /**
   * Foydalanuvchi uchun agregat statistikani hisoblash (WPM, Accuracy).
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const records = await this.getTestResultsByUserId(userId);
    
    if (records.length === 0) {
      return { totalTests: 0, avgWpm: 0, bestWpm: 0, avgAccuracy: 0 };
    }

    const testCount = records.length;
    const totalWpmAccumulated = records.reduce((sum, r) => sum + r.wpm, 0);
    const topWpm = Math.max(...records.map((r) => r.wpm));
    const totalAccAccumulated = records.reduce((sum, r) => sum + r.accuracy, 0);

    return {
      totalTests: testCount,
      avgWpm: Math.round(totalWpmAccumulated / testCount),
      bestWpm: topWpm,
      avgAccuracy: Math.round(totalAccAccumulated / testCount),
    };
  }

  // ============ LEADERBOARD OPERATIONS ============

  /**
   * Ma'lum til va davr uchun peshqadamlar ro'yxatini olish.
   */
  async getLeaderboard(period: string, language: string) {
    const entries = await db
      .select({ entry: leaderboardEntries, user: users })
      .from(leaderboardEntries)
      .innerJoin(users, eq(leaderboardEntries.userId, users.id))
      .where(and(eq(leaderboardEntries.period, period), eq(leaderboardEntries.language, language)))
      .orderBy(desc(leaderboardEntries.wpm));

    return entries.map((r) => ({ ...r.entry, user: r.user }));
  }

  /**
   * Foydalanuvchi natijasi oldingidan yaxshiroq bo'lsa, uni leaderboard-da yangilash.
   */
  async updateLeaderboardEntry(entry: InsertLeaderboardEntry): Promise<LeaderboardEntry> {
    const [currentBest] = await db
      .select()
      .from(leaderboardEntries)
      .where(
        and(
          eq(leaderboardEntries.userId, entry.userId),
          eq(leaderboardEntries.period, entry.period),
          eq(leaderboardEntries.language, entry.language)
        )
      );

    if (currentBest) {
      if (entry.wpm > currentBest.wpm) {
        const [updated] = await db
          .update(leaderboardEntries)
          .set({ wpm: entry.wpm, accuracy: entry.accuracy, updatedAt: new Date() })
          .where(eq(leaderboardEntries.id, currentBest.id))
          .returning();
        return updated;
      }
      return currentBest;
    }

    const [newEntry] = await db.insert(leaderboardEntries).values(entry).returning();
    return newEntry;
  }

  // ============ BATTLE OPERATIONS ============

  /**
   * Yangi multiplayer xonasi yaratish.
   */
  async createBattle(battle: InsertBattle): Promise<Battle> {
    const [arena] = await db.insert(battles).values(battle).returning();
    return arena;
  }

  /**
   * Xona kodini qidirish.
   */
  async getBattleByCode(code: string): Promise<Battle | undefined> {
    const [arena] = await db.select().from(battles).where(eq(battles.code, code));
    return arena;
  }

  /**
   * Xona holatini yangilash (waiting -> playing -> finished).
   */
  async updateBattleStatus(id: string, status: string): Promise<Battle> {
    const [updated] = await db
      .update(battles)
      .set({ status })
      .where(eq(battles.id, id))
      .returning();
    return updated;
  }

  /**
   * Jang ishtirokchilarini va ularning foydalanuvchi ma'lumotlarini olish.
   */
  async getBattleParticipants(battleId: string) {
    const members = await db
      .select({ participant: battleParticipants, user: users })
      .from(battleParticipants)
      .innerJoin(users, eq(battleParticipants.userId, users.id))
      .where(eq(battleParticipants.battleId, battleId));

    return members.map((r) => ({ ...r.participant, user: r.user }));
  }

  async addBattleParticipant(participant: InsertBattleParticipant): Promise<BattleParticipant> {
    const [entry] = await db.insert(battleParticipants).values(participant).returning();
    return entry;
  }

  // ============ SOCIAL & OTHERS ============

  async createReview(review: InsertReview): Promise<Review> {
    const [record] = await db.insert(reviews).values(review).returning();
    return record;
  }

  async getActiveCompetitions(): Promise<Competition[]> {
    return db
      .select()
      .from(competitions)
      .where(eq(competitions.isActive, true))
      .orderBy(competitions.date);
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
    const [updatedAd] = await db
      .update(advertisements)
      .set({ isActive })
      .where(eq(advertisements.id, id))
      .returning();
    return updatedAd;
  }

  async trackAdClick(id: string): Promise<void> {
    const [adRecord] = await db.select().from(advertisements).where(eq(advertisements.id, id));
    if (adRecord) {
      await db
        .update(advertisements)
        .set({ clicks: (adRecord.clicks || 0) + 1 })
        .where(eq(advertisements.id, id));
    }
  }

  async createCompetition(competition: InsertCompetition): Promise<Competition> {
    const [createdComp] = await db.insert(competitions).values(competition).returning();
    return createdComp;
  }

  async updateBattleParticipant(id: string, data: Partial<BattleParticipant>): Promise<BattleParticipant> {
    const [updatedParticipant] = await db
      .update(battleParticipants)
      .set(data)
      .where(eq(battleParticipants.id, id))
      .returning();
    return updatedParticipant;
  }
}

// ============ EXPORTS ============
export const storage = new DatabaseStorage();
