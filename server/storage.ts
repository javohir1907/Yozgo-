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
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { db, type DbExecutor } from "./db";
import { levelForXp } from "@shared/lib/xp";
import { friendships } from "@shared/schema";
import {
  User,
  TestResult,
  InsertTestResult,
  Battle,
  InsertBattle,
  BattleParticipant,
  InsertBattleParticipant,
  users,
  testResults,
  battles,
  battleParticipants,
  competitions,
  Competition,
  InsertCompetition,
  cosmetics,
  userCosmetics,
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

  // Gamifikatsiya — XP (server tomonda hisoblanadi)
  addUserXp(userId: string, deltaXp: number): Promise<{ xp: number; level: number }>;
  // Gamifikatsiya — Liga haftalik XP (Feature 5, Contract A). FAQAT solo+battle
  // faollik XP'sidan chaqiriladi (quest/streak XP'dan EMAS — double-count bo'lmasin).
  accrueWeeklyXp(userId: string, delta: number, executor?: DbExecutor): Promise<void>;
  // Gamifikatsiya — Coin + kosmetika (Feature 8)
  addUserCoins(userId: string, delta: number, executor?: DbExecutor): Promise<void>;
  listCosmeticsForUser(userId: string): Promise<any>;
  buyCosmetic(userId: string, key: string): Promise<{ coins: number }>;
  equipCosmetic(userId: string, key: string): Promise<void>;
  // Gamifikatsiya — Do'stlar (Feature 9)
  sendFriendRequest(requesterId: string, addresseeId: string): Promise<void>;
  acceptFriendRequest(addresseeId: string, requesterId: string): Promise<boolean>;
  getFriendIds(userId: string): Promise<string[]>;
  listFriendships(userId: string): Promise<any>;

  // Performance Tracking
  createTestResult(
    result: InsertTestResult,
    xpAwarded?: number,
    coinsAwarded?: number,
  ): Promise<TestResult>;
  getTestResultByClientId(userId: string, clientResultId: string): Promise<TestResult | undefined>;
  getTestResultsByUserId(userId: string): Promise<TestResult[]>;
  getUserStats(userId: string): Promise<UserStats>;

  // Gamifikatsiya — Badge (Feature 3)
  getUserBadges(userId: string): Promise<UserBadgesResult>;

  // Battle Arena (Multiplayer)
  createBattle(battle: InsertBattle): Promise<Battle>;
  getBattleByCode(code: string): Promise<Battle | undefined>;
  updateBattleStatus(id: string, status: string): Promise<Battle>;
  addBattleParticipant(participant: InsertBattleParticipant): Promise<BattleParticipant>;
  getBattleParticipants(battleId: string): Promise<(BattleParticipant & { user: User })[]>;
  updateBattleParticipant(id: string, data: Partial<BattleParticipant>): Promise<BattleParticipant>;

  // Security & Moderation
  setUserBanned(userId: string, isBanned: boolean): Promise<void>;
  updateUserIp(userId: string, ip: string): Promise<void>;

  // Social & Marketing
  getActiveCompetitions(): Promise<Competition[]>;
}

export type UserStats = {
  totalTests: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
};

export type BadgeView = { key: string; icon: string; earnedAt?: string };
export type UserBadgesResult = { earned: BadgeView[]; locked: BadgeView[] };

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
   * Test natijasini saqlash. `xpAwarded` SERVER tomonda alohida beriladi —
   * u insertTestResultSchema'dan omit qilingan (client uni yubora olmaydi),
   * shuning uchun bu yerda alohida parametr sifatida qabul qilinadi.
   */
  async createTestResult(
    result: InsertTestResult,
    xpAwarded = 0,
    coinsAwarded = 0,
  ): Promise<TestResult> {
    const [testResult] = await db
      .insert(testResults)
      .values({ ...result, xpAwarded, coinsAwarded })
      .returning();
    return testResult;
  }

  // ============ COIN + KOSMETIKA (Feature 8) ============

  /** Coin qo'shish (atomik). Banlangan foydalanuvchi coin olmaydi (Rule 2). */
  async addUserCoins(userId: string, delta: number, executor: DbExecutor = db): Promise<void> {
    if (!delta || delta <= 0) return;
    await executor
      .update(users)
      .set({ coins: sql`${users.coins} + ${delta}`, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.isBanned, false)));
  }

  /** Idempotency: (userId, clientResultId) bo'yicha mavjud natijani qaytaradi. */
  async getTestResultByClientId(
    userId: string,
    clientResultId: string,
  ): Promise<TestResult | undefined> {
    const [row] = await db
      .select()
      .from(testResults)
      .where(and(eq(testResults.userId, userId), eq(testResults.clientResultId, clientResultId)));
    return row;
  }

  /** Do'kon katalogi + foydalanuvchi balansi/egaligi. */
  async listCosmeticsForUser(userId: string): Promise<any> {
    const [u] = await db
      .select({
        coins: users.coins,
        streakFreezes: users.streakFreezes,
        equippedThemeKey: users.equippedThemeKey,
        equippedFrameKey: users.equippedFrameKey,
      })
      .from(users)
      .where(eq(users.id, userId));

    const rows: any = await db.execute(sql`
      SELECT c.key, c.type, c.price, c.meta, c.sort_order, (uc.id IS NOT NULL) AS owned
      FROM cosmetics c
      LEFT JOIN user_cosmetics uc ON uc.cosmetic_id = c.id AND uc.user_id = ${userId}
      WHERE c.is_active = true
      ORDER BY c.sort_order
    `);

    return {
      coins: u?.coins ?? 0,
      streakFreezes: u?.streakFreezes ?? 0,
      equippedThemeKey: u?.equippedThemeKey ?? null,
      equippedFrameKey: u?.equippedFrameKey ?? null,
      items: (rows.rows ?? []).map((r: any) => ({
        key: r.key,
        type: r.type,
        price: Number(r.price),
        meta: r.meta,
        owned: Boolean(r.owned),
      })),
    };
  }

  /**
   * Kosmetika sotib olish — SERVER tomonda balans+egalik tekshiruvi, atomik debit,
   * hammasi BITTA tranzaksiyada. streak_freeze — iste'mol (har safar +1 freeze).
   */
  async buyCosmetic(userId: string, key: string): Promise<{ coins: number }> {
    return await db.transaction(async (tx) => {
      const [cos] = await tx
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.key, key), eq(cosmetics.isActive, true)));
      if (!cos) throw new Error("NOT_FOUND");

      if (cos.type !== "streak_freeze") {
        const owned = await tx
          .select({ id: userCosmetics.id })
          .from(userCosmetics)
          .where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.cosmeticId, cos.id)));
        if (owned.length) throw new Error("ALREADY_OWNED");
      }

      // Atomik shartli debit — balans yetmasa row qaytmaydi.
      const debit = await tx
        .update(users)
        .set({ coins: sql`${users.coins} - ${cos.price}`, updatedAt: new Date() })
        .where(and(eq(users.id, userId), gte(users.coins, cos.price), eq(users.isBanned, false)))
        .returning({ coins: users.coins });
      if (!debit.length) throw new Error("INSUFFICIENT");

      if (cos.type === "streak_freeze") {
        await tx
          .update(users)
          .set({ streakFreezes: sql`${users.streakFreezes} + 1` })
          .where(eq(users.id, userId));
      } else {
        await tx
          .insert(userCosmetics)
          .values({ userId, cosmeticId: cos.id })
          .onConflictDoNothing();
      }
      return { coins: debit[0].coins };
    });
  }

  /** Kosmetika kiyish (egalik tekshiriladi; bir slot per type users ustunida). */
  async equipCosmetic(userId: string, key: string): Promise<void> {
    const [cos] = await db.select().from(cosmetics).where(eq(cosmetics.key, key));
    if (!cos) throw new Error("NOT_FOUND");
    const owned = await db
      .select({ id: userCosmetics.id })
      .from(userCosmetics)
      .where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.cosmeticId, cos.id)));
    if (!owned.length) throw new Error("NOT_OWNED");

    if (cos.type === "theme") {
      await db.update(users).set({ equippedThemeKey: key }).where(eq(users.id, userId));
    } else if (cos.type === "frame") {
      await db.update(users).set({ equippedFrameKey: key }).where(eq(users.id, userId));
    } else {
      throw new Error("NOT_EQUIPPABLE");
    }
  }

  /**
   * Foydalanuvchiga XP qo'shish (atomik, poyga-xavfsiz).
   *
   * 1-qadam: `xp = xp + delta` bitta atomik UPDATE + RETURNING (lost-update yo'q).
   * 2-qadam: yangi xp'dan level'ni levelForXp (xp.ts — yagona manba) bilan hisoblab,
   * `WHERE xp = newXp` guard bilan yozamiz — concurrent XP eventlarida faqat
   * ENG SO'NGGI xp'ga mos level saqlanadi (stale level yozilmaydi).
   */
  async addUserXp(userId: string, deltaXp: number): Promise<{ xp: number; level: number }> {
    if (!deltaXp || deltaXp <= 0) {
      const [u] = await db
        .select({ xp: users.xp, level: users.level })
        .from(users)
        .where(eq(users.id, userId));
      return { xp: u?.xp ?? 0, level: u?.level ?? 1 };
    }

    const [row] = await db
      .update(users)
      .set({ xp: sql`${users.xp} + ${deltaXp}`, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ xp: users.xp });

    const newXp = row?.xp ?? 0;
    const newLevel = levelForXp(newXp);

    await db
      .update(users)
      .set({ level: newLevel })
      .where(and(eq(users.id, userId), eq(users.xp, newXp)));

    return { xp: newXp, level: newLevel };
  }

  /**
   * Liga haftalik XP hisoblagichini oshiradi (Feature 5, Contract A).
   * Lazy enroll (Bronza, shu Tashkent haftasi) + atomik weekly_xp += delta.
   * Kun/hafta chegarasi SQL'da (date_trunc('week', Tashkent)) — TZ off-by-one yo'q.
   */
  async accrueWeeklyXp(userId: string, delta: number, executor: DbExecutor = db): Promise<void> {
    if (!delta || delta <= 0) return;
    await executor.execute(sql`
      INSERT INTO league_members (user_id, league_tier, weekly_xp, week_start)
      VALUES (${userId}, 0, 0, date_trunc('week', (now() AT TIME ZONE 'Asia/Tashkent'))::date)
      ON CONFLICT (user_id) DO NOTHING
    `);
    await executor.execute(sql`
      UPDATE league_members SET weekly_xp = weekly_xp + ${delta}, updated_at = now()
      WHERE user_id = ${userId}
    `);
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

  /**
   * Foydalanuvchining badge'lari: to'liq katalog (ochilgan + qulflangan).
   * Bitta LEFT JOIN — badge-boshiga alohida query yo'q.
   */
  async getUserBadges(userId: string): Promise<UserBadgesResult> {
    const res: any = await db.execute(sql`
      SELECT b.key, b.icon, b.sort_order, ub.earned_at
      FROM badges b
      LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ${userId}
      ORDER BY b.sort_order
    `);
    const earned: BadgeView[] = [];
    const locked: BadgeView[] = [];
    for (const r of res.rows ?? []) {
      if (r.earned_at) {
        earned.push({ key: r.key, icon: r.icon, earnedAt: String(r.earned_at) });
      } else {
        locked.push({ key: r.key, icon: r.icon });
      }
    }
    return { earned, locked };
  }

  // ============ LEADERBOARD OPERATIONS ============

  // NOTE: getLeaderboard / updateLeaderboardEntry olib tashlandi (0-bosqich qarori) —
  // global leaderboard endi faqat test_results'dan LeaderboardService orqali hisoblanadi.

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

  async getActiveCompetitions(): Promise<Competition[]> {
    return db
      .select()
      .from(competitions)
      .where(eq(competitions.isActive, true))
      .orderBy(competitions.startTime);
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

  // ============ DO'STLAR (Feature 9) ============

  /** Do'stlik so'rovi (kanonik juftlik; teskari/takror -> ON CONFLICT DO NOTHING). */
  async sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
    if (requesterId === addresseeId) throw new Error("SELF");
    await db.execute(sql`
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES (${requesterId}, ${addresseeId}, 'pending')
      ON CONFLICT (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id)) DO NOTHING
    `);
  }

  /** So'rovni qabul qilish (faqat addressee, pending -> accepted). */
  async acceptFriendRequest(addresseeId: string, requesterId: string): Promise<boolean> {
    const rows = await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(
        and(
          eq(friendships.requesterId, requesterId),
          eq(friendships.addresseeId, addresseeId),
          eq(friendships.status, "pending"),
        ),
      )
      .returning({ id: friendships.id });
    return rows.length > 0;
  }

  /** Qabul qilingan do'stlarning id'lari (ikki yo'nalish union). */
  async getFriendIds(userId: string): Promise<string[]> {
    const res: any = await db.execute(sql`
      SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END AS friend_id
      FROM friendships
      WHERE status = 'accepted' AND (requester_id = ${userId} OR addressee_id = ${userId})
    `);
    return (res.rows ?? []).map((r: any) => r.friend_id);
  }

  /** Do'stlar sahifasi uchun: qabul qilingan + kiruvchi/chiquvchi pending. */
  async listFriendships(userId: string): Promise<any> {
    const res: any = await db.execute(sql`
      SELECT f.id, f.requester_id, f.addressee_id, f.status,
             u.id AS other_id, u.first_name, u.email, u.profile_image_url
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = ${userId} THEN f.addressee_id ELSE f.requester_id END
      WHERE f.requester_id = ${userId} OR f.addressee_id = ${userId}
      ORDER BY f.created_at DESC
    `);
    const friends: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];
    for (const r of res.rows ?? []) {
      const other = {
        id: r.other_id,
        username: r.first_name || r.email?.split("@")[0] || "Unknown",
        avatarUrl: r.profile_image_url ?? null,
      };
      if (r.status === "accepted") friends.push(other);
      else if (r.addressee_id === userId) incoming.push(other);
      else outgoing.push(other);
    }
    return { friends, incoming, outgoing };
  }

  // ============ SECURITY & MODERATION ============

  async setUserBanned(userId: string, isBanned: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isBanned })
      .where(eq(users.id, userId));
  }

  async updateUserIp(userId: string, ip: string): Promise<void> {
    await db
      .update(users)
      .set({ updatedAt: new Date() }) // or add an ip field if we want to store it in user table too
      .where(eq(users.id, userId));
  }
}

// ============ EXPORTS ============
export const storage = new DatabaseStorage();
