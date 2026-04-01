/**
 * YOZGO - API Routes Configuration
 * 
 * Ushbu fayl platformaning barcha API endpointlarini boshqaradi.
 * Arxitektura: Express.js REST API + Real-time Battle Manager interfeysi.
 * 
 * @author YOZGO Team
 * @version 1.1.0
 */

// ============ IMPORTS ============
import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { z } from "zod";
import { eq, sql, desc, and } from "drizzle-orm";

import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated } from "./auth";
import { BattleManager } from "./battle-manager";

// Shared Schemas & Models
import {
  testResults,
  users,
  battles,
  roomAccessCodes,
  battleParticipants,
  competitions,
  advertisements,
  notifications,
  competitionParticipants,
  insertTestResultSchema,
  insertBattleSchema,
  insertReviewSchema,
  insertCompetitionSchema,
  insertAdvertisementSchema,
} from "@shared/schema";

let leaderboardCache = { data: null as any, lastFetched: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 daqiqa

// ============ CONSTANTS ============
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

const ERROR_MESSAGES = {
  INTERNAL: "Internal server error",
  USER_NOT_FOUND: "Foydalanuvchi topilmadi",
  BATTLE_NOT_FOUND: "Xona topilmadi",
  UNAUTHORIZED: "Ruxsat berilmagan",
  FORBIDDEN_ADMIN: "Faqat adminlar uchun ruxsat berilgan",
};

// ============ TYPES ============
interface AuthenticatedRequest extends Request {
  session: any;
}

// ============ ROUTES REGISTRATION ============

/**
 * Barcha API yo'nalishlarini Express ilovasiga ro'yxatdan o'tkazadi.
 * 
 * @param httpServer - HTTP Server obyekti (WebSockets uchun kerak)
 * @param app - Express ilovasi
 * @returns Sozlangan HTTP Server
 */
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Avtorizatsiya tizimini sozlash
  setupAuth(app);

  console.log("🚀 [SYSTEM] API ROUTER SUCCESSFULLY MOUNTED");

  // Jang menejerini ishga tushirish
  const battleManager = new BattleManager(httpServer);

  // ============ USER RESULTS ROUTES ============

  /**
   * @openapi
   * /api/results/me:
   *   get:
   *     tags: [Results]
   *     summary: Foydalanuvchining shaxsiy natijalarini olish
   */
  app.get("/api/results/me", isAuthenticated, async (req: Request, res: Response) => {
    const userId = req.session.userId;
    if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

    try {
      const results = await storage.getTestResultsByUserId(userId);
      res.status(HTTP_STATUS.OK).json(results);
    } catch (error) {
      console.error("[API] Error fetching user results:", error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Yangi test natijasini saqlash va peshqadamlar jadvalini yangilash.
   */
  app.post("/api/results", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

      // Ma'lumotlarni validatsiya qilish
      const validatedData = insertTestResultSchema.parse({ ...req.body, userId });
      const savedResult = await storage.createTestResult(validatedData);

      // Leaderboard-dagi umumiy hisobni yangilash
      await storage.updateLeaderboardEntry({
        userId,
        wpm: validatedData.wpm,
        accuracy: validatedData.accuracy,
        language: validatedData.language,
        period: "alltime",
      });

      res.status(HTTP_STATUS.CREATED).json(savedResult);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid test results data" });
      }
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  // ============ SOCIAL & LEADERBOARD ============

  /**
   * @openapi
   * /api/leaderboard:
   *   get:
   *     tags: [Social]
   *     summary: Peshqadamlar jadvalini olish
   */
  app.get("/api/leaderboard", async (req: Request, res: Response) => {
    try {
      const querySchema = z.object({
        language: z.enum(["all", "en", "ru", "uz"]).default("all"),
      });

      const { language } = querySchema.parse(req.query);

      // Keshlash mantig'i (faqat "all" holati uchun, qolganlarini on-the-fly hisoblaymiz)
      if (language === "all" && Date.now() - leaderboardCache.lastFetched < CACHE_TTL) {
        return res.status(HTTP_STATUS.OK).json(leaderboardCache.data);
      }

      // Dinamik filter shartlarini yaratish
      const filterConditions = language !== "all" ? eq(testResults.language, language) : undefined;

      // Murakkab SQL so'rovi: foydalanuvchi statistikasini bitta so'rovda hisoblash
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

      // Ma'lumotlarni frontend uchun formatlash (rank qo'shish)
      const formattedEntries = leaderboardData.map((user, index) => ({
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

      // Ma'lumotlarni formatlash qismidan keyin:
      if (language === "all") {
        leaderboardCache = { data: formattedEntries, lastFetched: Date.now() };
      }

      res.status(HTTP_STATUS.OK).json(formattedEntries);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid query parameters" });
      }
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Muayyan foydalanuvchi profilini va uning statistikasini olish.
   */
  app.get("/api/profile/:userId", async (req: Request, res: Response) => {
    try {
      const userId = String(req.params.userId);
      const userRecord = await storage.getUser(userId);

      if (!userRecord) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
      }

      const userStats = await storage.getUserStats(userId);
      const recentAttempts = await storage.getTestResultsByUserId(userId);

      res.status(HTTP_STATUS.OK).json({
        user: {
          id: userRecord.id,
          username: userRecord.firstName || userRecord.email?.split("@")[0] || "Anonymous",
          avatarUrl: userRecord.profileImageUrl,
        },
        stats: userStats,
        recentResults: recentAttempts,
      });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: "Failed to fetch profile" });
    }
  });

  // ============ BATTLE (ARENA) ROUTES ============

  /**
   * @openapi
   * /api/battles:
   *   post:
   *     tags: [Battle]
   *     summary: Yangi jang xonasi (Arena) yaratish
   */
  app.post("/api/battles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const validatedBattle = insertBattleSchema.parse(req.body);

      const createdBattle = await storage.createBattle({
        ...validatedBattle,
        creatorId: userId,
      });

      // Telegram Bot integratsiyasi: Xona yaratilgani haqida xabar yuborish
      try {
        const { sendRoomCreatedMessage } = require("./bot");
        sendRoomCreatedMessage(createdBattle.code);
      } catch (telegramError) {
        console.error("[BOT] Failed to notify about new room:", telegramError);
      }

      res.status(HTTP_STATUS.CREATED).json(createdBattle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid battle data" });
      }
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Berilgan kod orqali jang haqida ma'lumot va ishtirokchilarni olish.
   */
  app.get("/api/battles/:code", async (req: Request, res: Response) => {
    try {
      const battleRecord = await storage.getBattleByCode(String(req.params.code));
      if (!battleRecord) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: ERROR_MESSAGES.BATTLE_NOT_FOUND });
      }

      const participantsList = await storage.getBattleParticipants(battleRecord.id);
      res.status(HTTP_STATUS.OK).json({ ...battleRecord, participants: participantsList });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Xona kodini yoki individual kirish kodini validatsiya qilish (Anticheat birinchi qadam).
   */
  app.post("/api/battles/validate-code", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { battleCode } = req.body;
      let matchedBattle = await storage.getBattleByCode(battleCode);
      let isSpecificAccessCode = false;

      // Avval individual kirish kodlarini tekshiramiz
      const [accessCodeEntry] = await db
        .select()
        .from(roomAccessCodes)
        .where(eq(roomAccessCodes.code, battleCode));

      if (accessCodeEntry) {
        if (accessCodeEntry.isUsed) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Bu kod allaqachon foydalanilgan." });
        }
        isSpecificAccessCode = true;
        const [foundBattle] = await db.select().from(battles).where(eq(battles.id, accessCodeEntry.roomId));
        matchedBattle = foundBattle;
      }

      if (!matchedBattle) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Xona yoki kirish kodi topilmadi." });
      }

      // Faqat bot orqali olingan individual kodlar bilan kirishga ruxsat berish
      if (!isSpecificAccessCode) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          message: "Xonaga faqat @yozgo_bot orqali olingan individual kod bilan kirish mumkin.",
        });
      }

      res.status(HTTP_STATUS.OK).json({ success: true });
    } catch (error) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({ message: error instanceof Error ? error.message : "Xatolik" });
    }
  });

  /**
   * Xonaga ishtirokchi sifatida qo'shilish (Database darajasida).
   */
  app.post("/api/battles/join", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { battleCode, agreed } = req.body;
      const userId = req.session.userId;

      if (!agreed) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Shartlarga rozilik berilmagan" });
      }

      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

      let matchedBattle = await storage.getBattleByCode(battleCode);

      // Avval individual kirish kodlarini tekshiramiz
      const [accessCodeEntry] = await db
        .select()
        .from(roomAccessCodes)
        .where(eq(roomAccessCodes.code, battleCode));

      if (accessCodeEntry) {
        if (accessCodeEntry.isUsed) {
          // It's already used but maybe this is the same user clicking "Join" again after validating
          // We'll let it pass for now if they are already a participant, but for safety:
          console.log(`[BATTLE JOIN] Code ${battleCode} is already marked as used.`);
        } else {
          // Koddan foydalanildi deb belgilash
          await db.update(roomAccessCodes).set({ isUsed: true }).where(eq(roomAccessCodes.id, accessCodeEntry.id));
        }

        const [foundBattle] = await db.select().from(battles).where(eq(battles.id, accessCodeEntry.roomId));
        matchedBattle = foundBattle;
      }

      if (!matchedBattle) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Xona topilmadi" });
      }

      // Ishtirokchini bazaga qo'shish (Duplicate check storage ichida)
      try {
        await storage.addBattleParticipant({
          battleId: matchedBattle.id,
          userId: userId,
        });
      } catch (dbError) {
        // Agar allaqachon qo'shilgan bo'lsa, xatolikni e'tiborsiz qoldiramiz
        console.log("[BATTLE JOIN] User already in room or DB error:", (dbError as any).message);
      }

      // Frontendga asl xona kodini (e.g. "X2K9L") qaytaramiz
      res.status(HTTP_STATUS.OK).json({ roomCode: matchedBattle.code });
    } catch (error) {
      console.error("[BATTLE JOIN] Error:", error);
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: "Xonaga qo'shilishda xatolik yuz berdi" });
    }
  });

  // ============ COMPETITIONS & ADS ============

  /**
   * Faol musobaqalarni olish mundarijasi.
   */
  app.get("/api/competitions", async (_req: Request, res: Response) => {
    try {
      const activeCompetitionsList = await storage.getActiveCompetitions();
      res.status(HTTP_STATUS.OK).json(activeCompetitionsList);
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Reklamalarni olish (aktivlari).
   */
  app.get("/api/advertisements", async (_req: Request, res: Response) => {
    try {
      const activeAds = await db.select().from(advertisements).where(eq(advertisements.isActive, true));
      res.status(HTTP_STATUS.OK).json(activeAds);
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  // ============ ADMIN CONTROL PANEL ============

  /**
   * Admin ekanligini tekshirish uchun middleware.
   */
  const adminGuard = async (req: Request, res: Response, next: any) => {
    const botSecret = process.env.BOT_SECRET;
    
    // XAVFSIZLIK: Bot secret faqat serverdan (localhost yoki render internal) kelsa ishlashi kerak
    // Ammo hozircha oddiy tekshiruv qoldiramiz, faqat sir o'ta kuchli bo'lishi shart!
    if (botSecret && req.headers["x-bot-secret"] === botSecret) {
      return next();
    }

    const currentUserId = req.session?.userId;
    if (!currentUserId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

    const currentUser = await storage.getUser(currentUserId);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ message: ERROR_MESSAGES.FORBIDDEN_ADMIN });
    }
    next();
  };

  /**
   * Platforma bo'yicha umumiy statistikani olish (Admin panel uchun).
   */
  app.get("/api/admin/bot-stats", adminGuard, async (_req: Request, res: Response) => {
    try {
      const usersStats = await db.execute(sql`SELECT count(*) FROM users`);
      const dailyActiveUsers = await db.execute(sql`SELECT count(*) FROM users WHERE date(created_at) = current_date`);
      
      res.status(HTTP_STATUS.OK).json({
        totalUsers: Number(usersStats.rows[0].count),
        todayUsers: Number(dailyActiveUsers.rows[0].count),
      });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  // ============ PUBLIC SYSTEM INFO ============

  /**
   * Tashqi dunyo yoki AI botlar uchun platforma statistikasi (Open Data).
   */
  app.get("/api/public/info", async (_req: Request, res: Response) => {
    try {
      const activeBattleCount = await db.execute(sql`SELECT count(*) FROM battles WHERE status IN ('waiting', 'playing')`);
      const testStats = await db.execute(sql`SELECT count(*), COALESCE(round(avg(wpm)), 0) as avg_wpm FROM test_results`);
      const usersTotal = await db.execute(sql`SELECT count(*) FROM users`);

      // CORS allow for public info
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(HTTP_STATUS.OK).json({
        platform: "YOZGO",
        description: "Eng yirik o'zbek typing platformasi.",
        stats: {
          totalUsers: Number(usersTotal.rows[0].count),
          activeBattles: Number(activeBattleCount.rows[0].count),
          avgWpm: Number(testStats.rows[0].avg_wpm),
        }
      });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  return httpServer;
}
