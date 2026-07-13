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
import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { z } from "zod";
import { eq, sql, desc, and, inArray } from "drizzle-orm";

import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated } from "./auth";
import { BattleManager } from "./battle-manager";
import { sendAdminNotification } from "./utils/notifier";
import { checkGenderEligibility } from "./utils/battle-access";
import { LeaderboardService } from "./services/leaderboard.service";
import * as StreakService from "./services/streak.service";
import { evaluateBadges } from "./gamification/badge-service";
import { getStandingForUser } from "./services/league.service";
import * as QuestService from "./services/quest.service";
import { computeSoloXp, xpProgress, levelForXp } from "@shared/lib/xp";
import { resolveRank } from "@shared/lib/rank";
import { computeSoloCoins } from "@shared/lib/coins";
import { cosmeticMeta } from "./gamification/cosmetic-defs";
import { inviteFriendToBattle } from "./userBot";

// Shared Schemas & Models
import crypto from "crypto";

import {
  users,
  battles,
  battleParticipants,
  testResults,
  roomAccessCodes,
  competitions,
  competitionParticipants,
  insertTestResultSchema,
  systemSettings,
  competitionCreationCodes,
  badges,
  userBadges,
  leagues,
  leagueMembers,
  adminAuditLog,
} from "@shared/schema";

// Leaderboard cache — `${language}:${period}` bo'yicha kalanadi (period qo'shilgach
// yagona obyekt yetmaydi: weekly so'rovga all-time payload berish data corruption bo'lardi).
const leaderboardCache = new Map<string, { data: any; lastFetched: number }>();
const CACHE_TTL_ALL = 5 * 60 * 1000; // all-time: 5 daqiqa
const CACHE_TTL_PERIOD = 60 * 1000; // weekly/monthly: 60s (jonli board tez yangilansin)

// XAVFSIZLIK: foydalanuvchini client'ga qaytarishda ishlatiladigan ustunlar.
// `password` (bcrypt hash) ATAYLAB chiqarilmagan — admin endpointlari ham
// parol hashini oshkor qilmasin.
const safeUserColumns = {
  id: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  profileImageUrl: users.profileImageUrl,
  telegramId: users.telegramId,
  role: users.role,
  gender: users.gender,
  isBanned: users.isBanned,
  lastNicknameChangeAt: users.lastNicknameChangeAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

// ============ CONSTANTS ============
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYMENT_REQUIRED: 402,
  INTERNAL_ERROR: 500,
};

// ============ UTILS ============
function generateRoomCode(length: number = 5): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O, I, 0, 1 for clarity
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
}

const ERROR_MESSAGES = {
  INTERNAL: "Internal server error",
  USER_NOT_FOUND: "Foydalanuvchi topilmadi",
  BATTLE_NOT_FOUND: "Xona topilmadi",
  UNAUTHORIZED: "Ruxsat berilmagan",
  FORBIDDEN_ADMIN: "Faqat adminlar uchun ruxsat berilgan",
};

// Admin audit yozuvi — fire-and-forget (asosiy amalni bloklamaydi). adminId
// bot-secret yo'lida null bo'lishi mumkin (session yo'q).
async function writeAudit(
  adminId: string | null | undefined,
  action: string,
  targetUserId: string | null | undefined,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      adminId: adminId ?? null,
      action,
      targetUserId: targetUserId ?? null,
      details: details as any,
    });
  } catch (e) {
    console.error("[AUDIT] yozishda xatolik:", e);
  }
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

  // NOTE: GET /api/results/me olib tashlandi (orphan) — client uni chaqirmaydi;
  // profil natijalari GET /api/profile/:userId orqali olinadi.

  /**
   * Yangi test natijasini saqlash va peshqadamlar jadvalini yangilash.
   */
  app.post("/api/results", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

      // Ma'lumotlarni validatsiya qilish. source majburan 'solo' — client uni
      // 'battle' deb yuborib leaderboard'dan yashira olmasin (spoofing oldini olish).
      const validatedData = insertTestResultSchema.parse({ ...req.body, userId, source: "solo" });

      // ANTI-CHEAT: Absolute limit check
      if (validatedData.wpm > 260) {
        console.warn(`🚨 [LIMIT] Manual Result: User ${userId} exceeded WPM limit: ${validatedData.wpm}`);
        return res.status(HTTP_STATUS.FORBIDDEN).json({ message: "Sizning natijangiz shubhali deb topildi. Iltimos, halol o'ynang!" });
      }

      // ANTI-CHEAT/BAN gate (gamifikatsiya Rule 2): isAuthenticated faqat session'ni
      // tekshiradi, is_banned'ni EMAS. Banlangan foydalanuvchi natija ham saqlamaydi,
      // XP ham olmaydi.
      const actor = await storage.getUser(userId);
      if (!actor || actor.isBanned) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({ message: "Hisobingiz bloklangan." });
      }

      // XP/coin SERVER tomonda hisoblanadi (client hech qachon yubormaydi).
      const xpAwarded = computeSoloXp({ wpm: validatedData.wpm, accuracy: validatedData.accuracy });
      const coinsAwarded = computeSoloCoins({ wpm: validatedData.wpm, accuracy: validatedData.accuracy });
      const clientResultId = validatedData.clientResultId ?? null;

      // IDEMPOTENCY tez yo'li: shu client_result_id bilan natija allaqachon bo'lsa —
      // mavjudini qaytar, hech qanday mukofot bermay (retry to'liq no-op).
      if (clientResultId) {
        const existing = await storage.getTestResultByClientId(userId, clientResultId);
        if (existing) {
          const prog = xpProgress(actor.xp ?? 0);
          return res.status(HTTP_STATUS.OK).json({
            ...existing,
            idempotent: true,
            xp: prog.xp,
            level: prog.level,
            xpAwarded: 0,
            coinsAwarded: 0,
            currentStreak: actor.currentStreak ?? 0,
            longestStreak: actor.longestStreak ?? 0,
          });
        }
      }

      // Natija + XP/level/streak/coin/weekly_xp — BITTA tranzaksiyada. GATE:
      // INSERT ... ON CONFLICT (user_id, client_result_id) DO NOTHING — faqat haqiqatan
      // yozgan (RETURNING) so'rov mukofot oladi (concurrent retry ham no-op).
      const outcome = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(testResults)
          .values({
            userId,
            wpm: validatedData.wpm,
            accuracy: validatedData.accuracy,
            language: validatedData.language,
            mode: validatedData.mode,
            source: "solo",
            xpAwarded,
            coinsAwarded,
            clientResultId,
          })
          .onConflictDoNothing({ target: [testResults.userId, testResults.clientResultId] })
          .returning();

        if (inserted.length === 0) return { isNew: false as const };

        const row = inserted[0];
        // XP + streak (atomik) — tx bilan.
        const streakXp = await StreakService.updateStreakAndXp(userId, xpAwarded, tx);
        // Liga haftalik XP (Contract A) — faollik XP'si bilan — tx.
        if (xpAwarded > 0) await storage.accrueWeeklyXp(userId, xpAwarded, tx);
        // Coin — tx.
        if (coinsAwarded > 0) await storage.addUserCoins(userId, coinsAwarded, tx);
        return { isNew: true as const, row, ...streakXp };
      });

      if (!outcome.isNew) {
        // Concurrent retry tranzaksiya ichida to'qnashdi — mavjud natijani qaytar (no-op).
        const existing = clientResultId
          ? await storage.getTestResultByClientId(userId, clientResultId)
          : undefined;
        const prog = xpProgress(actor.xp ?? 0);
        return res.status(HTTP_STATUS.OK).json({
          ...(existing ?? {}),
          idempotent: true,
          xp: prog.xp,
          level: prog.level,
          xpAwarded: 0,
          coinsAwarded: 0,
          currentStreak: actor.currentStreak ?? 0,
          longestStreak: actor.longestStreak ?? 0,
        });
      }

      // Yangi natija: quest + badge fire-and-forget (o'zlari idempotent — retry'da
      // umuman chaqirilmaydi, chunki yuqorida no-op qaytdi).
      void QuestService.incrementQuests(userId, {
        type: "solo",
        wpm: validatedData.wpm,
        accuracy: validatedData.accuracy,
        mode: validatedData.mode,
      });
      void evaluateBadges(userId, { resultAccuracy: validatedData.accuracy, source: "solo" });

      res.status(HTTP_STATUS.CREATED).json({
        ...outcome.row,
        xp: outcome.xp,
        level: outcome.level,
        xpAwarded,
        coinsAwarded,
        currentStreak: outcome.currentStreak,
        longestStreak: outcome.longestStreak,
      });
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
        period: z.enum(["weekly", "monthly", "all"]).default("all"),
        mode: z.enum(["global", "friends"]).default("global"),
      });

      const { language, period, mode } = querySchema.parse(req.query);

      // Friends mode (Feature 9): har foydalanuvchi uchun har xil -> cache BYPASS.
      if (mode === "friends") {
        const userId = req.session.userId;
        if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
        const friendIds = await storage.getFriendIds(userId);
        friendIds.push(userId); // o'zini ham ko'rsin
        const data = await LeaderboardService.getLeaderboardData(language, period, friendIds);
        return res.status(HTTP_STATUS.OK).json(data);
      }

      // Keshlash: har (language, period) juftligi alohida kalit. Yangi natija faqat
      // TTL tugagach ko'rinadi (leaderboard-write invalidation site YO'Q — 0-bosqichda
      // olib tashlangan). weekly/monthly qisqa TTL bilan tezroq yangilanadi.
      const cacheKey = `${language}:${period}`;
      const ttl = period === "all" ? CACHE_TTL_ALL : CACHE_TTL_PERIOD;
      const hit = leaderboardCache.get(cacheKey);
      if (hit && Date.now() - hit.lastFetched < ttl) {
        return res.status(HTTP_STATUS.OK).json(hit.data);
      }

      // Toza Arxitektura: DB va Mantiq Service'ga topshirildi
      const formattedEntries = await LeaderboardService.getLeaderboardData(language, period);
      leaderboardCache.set(cacheKey, { data: formattedEntries, lastFetched: Date.now() });

      res.status(HTTP_STATUS.OK).json(formattedEntries);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid query parameters" });
      }
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Do'kon katalogi + foydalanuvchi balansi/egaligi (Feature 8).
   */
  app.get("/api/shop", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const data = await storage.listCosmeticsForUser(userId);
      res.status(HTTP_STATUS.OK).json(data);
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Kosmetika sotib olish (SERVER tomonda balans/egalik, atomik). Feature 8.
   */
  app.post("/api/shop/buy", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const key = String(req.body?.key || "");
      if (!key) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "key kerak" });
      const result = await storage.buyCosmetic(userId, key);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error: any) {
      const msg = error?.message;
      if (msg === "INSUFFICIENT") return res.status(HTTP_STATUS.PAYMENT_REQUIRED).json({ message: "Coin yetarli emas" });
      if (msg === "ALREADY_OWNED") return res.status(HTTP_STATUS.CONFLICT).json({ message: "Allaqachon sizda bor" });
      if (msg === "NOT_FOUND") return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Kosmetika topilmadi" });
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Kosmetika kiyish (Feature 8).
   */
  app.post("/api/shop/equip", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const key = String(req.body?.key || "");
      if (!key) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "key kerak" });
      await storage.equipCosmetic(userId, key);
      res.status(HTTP_STATUS.OK).json({ ok: true });
    } catch (error: any) {
      const msg = error?.message;
      if (msg === "NOT_OWNED") return res.status(HTTP_STATUS.FORBIDDEN).json({ message: "Bu sizda yo'q" });
      if (msg === "NOT_FOUND") return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Kosmetika topilmadi" });
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  // ============ DO'STLAR (Feature 9) ============

  app.get("/api/friends", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      res.status(HTTP_STATUS.OK).json(await storage.listFriendships(userId));
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  app.post("/api/friends/request", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const addresseeId = String(req.body?.addresseeId || "");
      if (!addresseeId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "addresseeId kerak" });
      if (addresseeId === userId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "O'zingizga so'rov yubora olmaysiz" });
      const target = await storage.getUser(addresseeId);
      if (!target) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
      await storage.sendFriendRequest(userId, addresseeId);
      res.status(HTTP_STATUS.OK).json({ ok: true });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  app.post("/api/friends/accept", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const requesterId = String(req.body?.requesterId || "");
      if (!requesterId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "requesterId kerak" });
      const ok = await storage.acceptFriendRequest(userId, requesterId);
      res.status(HTTP_STATUS.OK).json({ ok });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  app.post("/api/friends/invite-battle", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const friendId = String(req.body?.friendId || "");
      const battleCode = String(req.body?.battleCode || "");
      if (!friendId || !battleCode) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "friendId va battleCode kerak" });
      // Faqat qabul qilingan do'stni taklif qilish mumkin (begonaga spam bo'lmasin).
      const friendIds = await storage.getFriendIds(userId);
      if (!friendIds.includes(friendId)) return res.status(HTTP_STATUS.FORBIDDEN).json({ message: "Bu foydalanuvchi do'stingiz emas" });
      const friend = await storage.getUser(friendId);
      if (!friend?.telegramId) return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Do'stingizda Telegram ulanmagan" });
      const inviter = await storage.getUser(userId);
      await inviteFriendToBattle(Number(friend.telegramId), battleCode, inviter?.firstName || "Do'stingiz");
      res.status(HTTP_STATUS.OK).json({ ok: true });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Bugungi kunlik questlar va progress (Feature 6).
   */
  app.get("/api/quests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const data = await QuestService.getTodayQuests(userId);
      res.status(HTTP_STATUS.OK).json(data);
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  /**
   * Foydalanuvchining joriy liga holati va cohort reytingi (Feature 5).
   */
  app.get("/api/league/me", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
      const standing = await getStandingForUser(userId);
      res.status(HTTP_STATUS.OK).json(standing);
    } catch (error) {
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

      // Gamifikatsiya — XP/level progress (xp.ts yagona manba; qo'shimcha query yo'q).
      const prog = xpProgress(userRecord.xp ?? 0);
      // Badge katalogi (ochilgan + qulflangan).
      const badges = await storage.getUserBadges(userId);

      res.status(HTTP_STATUS.OK).json({
        user: {
          id: userRecord.id,
          username: userRecord.firstName || userRecord.email?.split("@")[0] || "Anonymous",
          avatarUrl: userRecord.profileImageUrl,
          gender: userRecord.gender, // Yangi qo'shilgan maydon
          role: userRecord.role,
          xp: prog.xp,
          level: prog.level,
          xpIntoLevel: prog.xpIntoLevel,
          xpForNextLevel: prog.xpForNextLevel,
          levelPct: prog.pct,
          currentStreak: userRecord.currentStreak ?? 0,
          longestStreak: userRecord.longestStreak ?? 0,
          rank: resolveRank(userStats.bestWpm).key, // Feature 7 — unvon (vizual)
          // Feature 8 — coin + kiyilgan kosmetika (theme/frame meta bilan)
          coins: userRecord.coins ?? 0,
          equippedThemeKey: userRecord.equippedThemeKey ?? null,
          equippedFrameKey: userRecord.equippedFrameKey ?? null,
          themeMeta: cosmeticMeta(userRecord.equippedThemeKey),
          frameMeta: cosmeticMeta(userRecord.equippedFrameKey),
        },
        stats: userStats,
        detailedStats: {
          uz: {
            15: recentAttempts.filter(r => r.language === 'uz' && r.mode === '15').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            30: recentAttempts.filter(r => r.language === 'uz' && r.mode === '30').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            60: recentAttempts.filter(r => r.language === 'uz' && r.mode === '60').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
          },
          ru: {
            15: recentAttempts.filter(r => r.language === 'ru' && r.mode === '15').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            30: recentAttempts.filter(r => r.language === 'ru' && r.mode === '30').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            60: recentAttempts.filter(r => r.language === 'ru' && r.mode === '60').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
          },
          en: {
            15: recentAttempts.filter(r => r.language === 'en' && r.mode === '15').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            30: recentAttempts.filter(r => r.language === 'en' && r.mode === '30').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            60: recentAttempts.filter(r => r.language === 'en' && r.mode === '60').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
          },
          kaa: {
            15: recentAttempts.filter(r => r.language === 'kaa' && r.mode === '15').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            30: recentAttempts.filter(r => r.language === 'kaa' && r.mode === '30').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
            60: recentAttempts.filter(r => r.language === 'kaa' && r.mode === '60').sort((a,b) => b.wpm - a.wpm)[0]?.wpm || 0,
          }
        },
        recentResults: recentAttempts.slice(0, 20), // Oxirgi 20 ta natija chart uchun
        badges, // Feature 3 — { earned, locked }
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
      
      const { 
        language, mode, maxParticipants, genderRestriction, 
        accessCode, duration, competitionLength, role 
      } = req.body;

      // 1. Foydalanuvchini olish
      const [userRecord] = await db.select().from(users).where(eq(users.id, userId));
      if (!userRecord) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });

      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
      const isAdminEmail = userRecord.email ? adminEmails.includes(userRecord.email.toLowerCase()) : false;

      let finalMaxParticipants = parseInt(maxParticipants || "10");
      let isOfficial = isAdminEmail;
      let roomPrice = 0;

      // 2. Narx va limitlarni tekshirish (Admin bo'lmasa)
      if (!isAdminEmail) {
        // Agar xona yaratish kodi kiritilgan bo'lsa:
        if (accessCode) {
          const [validCode] = await db.select().from(competitionCreationCodes)
            .where(and(
              eq(competitionCreationCodes.code, accessCode), 
              eq(competitionCreationCodes.isUsed, false)
            ));
            
          if (!validCode) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Noto'g'ri yoki allaqachon ishlatilgan kirish kodi." });
          }

          // Muddatini tekshirish
          if (validCode.expiresAt && new Date() > validCode.expiresAt) {
             return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Ushbu kodning amal qilish muddati tugagan (5 kun o'tib ketgan)." });
          }
          
          finalMaxParticipants = validCode.maxParticipants;
          // Kodni ishlatilgan deb belgilash
          await db.update(competitionCreationCodes).set({ 
            isUsed: true, 
            usedByUserId: userId,
            usedAt: new Date()
          }).where(eq(competitionCreationCodes.id, validCode.id));
        } else {
          // Oddiy bepul/pullik limitlar
          if (finalMaxParticipants > 100) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
              message: "100+ kishilik xona ochish uchun @uergo ga yozib kod oling!" 
            });
          }
          
          if (finalMaxParticipants > 10) {
            if (finalMaxParticipants <= 20) roomPrice = 29000;
            else if (finalMaxParticipants <= 50) roomPrice = 59000;
            else roomPrice = 110000;
            
            // Kod kiritilmagan bo'lsa pullik xona ochib bo'lmaydi
            return res.status((HTTP_STATUS as any).PAYMENT_REQUIRED).json({ 
              message: `Ushbu xona narxi: ${roomPrice.toLocaleString()} so'm. Kod olish uchun @uergo ga yozing!`,
              price: roomPrice
            });
          }
        }
      }

      // 3. Jins tekshiruvi (Agar xonada cheklov bo'lsa, yaratuvchi o'sha jinsda bo'lishi kerak yoki admin bo'lishi kerak)
      if (!isAdminEmail && genderRestriction !== 'all' && userRecord.gender !== genderRestriction) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Siz ushbu jins uchun mo'ljallangan xonani ocholmaysiz." });
      }

      // 4. Xonani yaratish
      const createdBattle = await storage.createBattle({
        code: generateRoomCode(),
        language,
        mode,
        creatorId: userId,
        status: 'waiting',
        maxParticipants: finalMaxParticipants,
        genderRestriction: genderRestriction || 'all',
        isOfficial: isOfficial,
        roomPrice: roomPrice,
        accessCode: accessCode || null,
        duration: parseInt(duration || "60"),
        competitionLength: parseInt(competitionLength || "10"),
        role: role || 'participant'
      });
      
      const genderText = genderRestriction === 'male' ? "🧍‍♂️ Faqat Yigitlar uchun" : 
                         genderRestriction === 'female' ? "🧍‍♀️ Faqat Qizlar uchun" : 
                         "👫 Barcha (Aralash)";

      const adminMsg = `⚡️ <b>JANG XONASIGA KIRISH OCHILDI!</b>\n\n` +
                       `🎯 Jins cheklovi: <b>${genderText}</b>\n` +
                       `🚀 Asl Xona Kodi: <code>${createdBattle.code}</code>\n\n` +
                       `👆 Xona kodining ustiga bossangiz avtomatik nusxa olinadi. Nuxsalangan kodni tegishli @yozgo_bot ga yuborib, o'z individual bir martalik kodingizni oling.`;
      
      const adminKeyboard = {
        inline_keyboard: [
          [
            { text: "📢 Kanalga e'lon qilish (@yozgo_uz)", callback_data: `send_channel_${createdBattle.code}` }
          ]
        ]
      };
                       
      sendAdminNotification(adminMsg, adminKeyboard).catch(console.error);

      res.status(HTTP_STATUS.CREATED).json(createdBattle);
    } catch (error: any) {
      console.error("[API] Battle Creation Error:", error);
      // XAVFSIZLIK: stack trace va ichki xato matni client'ga yuborilmaydi (yuqorida log qilingan).
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  // NOTE: GET /api/battles/:code olib tashlandi (orphan + auth yo'q info-leak) —
  // client uni chaqirmaydi; join oqimi validate-code + join orqali ishlaydi.

  /**
   * Xona kodini yoki individual kirish kodini validatsiya qilish (Anticheat birinchi qadam).
   */
  app.post("/api/battles/validate-code", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { battleCode } = req.body;
      let matchedBattle = await storage.getBattleByCode(battleCode);
      let isSpecificAccessCode = false;

      // 1. Paid Room Creation code orqali tekshirish
      const [creationCodeEntry] = await db.select().from(competitionCreationCodes).where(eq(competitionCreationCodes.code, battleCode));
      if (creationCodeEntry) {
         if (creationCodeEntry.expiresAt && new Date() > creationCodeEntry.expiresAt) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Ushbu kodning muddati tugagan (5 kun o'tib ketgan)." });
         }
         return res.status(HTTP_STATUS.OK).json({ success: true });
      }

      // 2. Individual kirish kodi orqali tekshirish
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

      if (!isSpecificAccessCode && !creationCodeEntry) {
         // Kiritilgan kod to'g'ridan to'g'ri asl xona kodi (Native Battle Code) bo'lsa bloklaymiz
         if (matchedBattle.code === battleCode) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Asl xona kodi bilan to'g'ridan-to'g'ri kirish taqiqlanadi! Iltimos, ushbu kodni @yozgo_bot ga yuborib individual o'yin kodingizni oling." });
         }
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

      // --- YANGI: Paid Creation Codes orqali qo'shilish ---
      let creationCodeUsed = false;
      if (!matchedBattle) {
        const [creationCodeEntry] = await db.select().from(competitionCreationCodes)
          .where(eq(competitionCreationCodes.code, battleCode));

        if (creationCodeEntry) {
          creationCodeUsed = true;
          if (creationCodeEntry.expiresAt && new Date() > creationCodeEntry.expiresAt) {
             return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Ushbu kodning muddati tugagan." });
          }

          // Agar shu creation kodi allaqachon ishlatilayotgan bo'lmasa yoki qayta-ushbu xonaga kirish bo'lsa
          let battleToJoin = null;
          
          if (creationCodeEntry.activeBattleId) {
             const [activeBattle] = await db.select().from(battles).where(eq(battles.id, creationCodeEntry.activeBattleId));
             if (activeBattle && activeBattle.status !== 'finished') {
                battleToJoin = activeBattle;
             }
          }

          if (!battleToJoin) {
             battleToJoin = await storage.createBattle({
               code: generateRoomCode(),
               language: "uz",
               mode: "30",
               creatorId: userId,
               status: 'waiting',
               maxParticipants: creationCodeEntry.maxParticipants,
               genderRestriction: 'all',
               isOfficial: true,
               roomPrice: 0,
               accessCode: creationCodeEntry.code,
               duration: 30,
               competitionLength: 10,
               role: 'participant'
             });

             await db.update(competitionCreationCodes)
               .set({ 
                 activeBattleId: battleToJoin.id,
                 isUsed: true,
                 usedByUserId: userId,
                 usedAt: new Date()
               })
               .where(eq(competitionCreationCodes.id, creationCodeEntry.id));
          }
          matchedBattle = battleToJoin as any;
        }
      }

      if (!matchedBattle) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Xona topilmadi" });
      }

      // 🚨 QAT'IY JINS TEKSHIRUVI (ANTI-HACK) — socket join bilan bir xil qoida.
      if (matchedBattle.genderRestriction !== 'all') {
        const [userRecord] = await db.select().from(users).where(eq(users.id, userId));
        if (!userRecord) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
        }
        const genderCheck = checkGenderEligibility(userRecord.gender, matchedBattle.genderRestriction);
        if (!genderCheck.ok) {
          const status = userRecord.gender ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.BAD_REQUEST;
          return res.status(status).json({ message: genderCheck.message });
        }
      }
      // ====================================================

      const isAccessCode = !!accessCodeEntry || creationCodeUsed;
      if (!isAccessCode && matchedBattle.code === battleCode) {
         return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Xonaga asl kodi orqali to'g'ridan-to'g'ri kirib bo'lmaydi. Uni @yozgo_bot ga jo'natib individual kod oling." });
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

  // Musobaqaga ro'yxatdan o'tish (auth). competition_participants'ga yozadi.
  app.post("/api/competitions/:id/register", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId as string;
      const competitionId = parseInt(req.params.id as string, 10);
      if (Number.isNaN(competitionId)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Noto'g'ri musobaqa ID" });
      }

      const [comp] = await db.select().from(competitions).where(eq(competitions.id, competitionId));
      if (!comp) return res.status(HTTP_STATUS.NOT_FOUND).json({ message: "Musobaqa topilmadi" });

      const [existing] = await db
        .select({ id: competitionParticipants.id })
        .from(competitionParticipants)
        .where(and(eq(competitionParticipants.competitionId, competitionId), eq(competitionParticipants.userId, userId)));
      if (existing) {
        return res.status(HTTP_STATUS.OK).json({ message: "Siz allaqachon ro'yxatdan o'tgansiz", alreadyRegistered: true });
      }

      await db.insert(competitionParticipants).values({ competitionId, userId });
      res.status(HTTP_STATUS.CREATED).json({ message: "Muvaffaqiyatli ro'yxatdan o'tdingiz" });
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  // Musobaqa ishtirokchilari ro'yxati (ommaviy).
  app.get("/api/competitions/:id/participants", async (req: Request, res: Response) => {
    try {
      const competitionId = parseInt(req.params.id as string, 10);
      if (Number.isNaN(competitionId)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Noto'g'ri musobaqa ID" });
      }

      const rows = await db
        .select({
          id: competitionParticipants.id,
          userId: competitionParticipants.userId,
          username: users.firstName,
          avatarUrl: users.profileImageUrl,
          registeredAt: competitionParticipants.registeredAt,
        })
        .from(competitionParticipants)
        .innerJoin(users, eq(competitionParticipants.userId, users.id))
        .where(eq(competitionParticipants.competitionId, competitionId))
        .orderBy(desc(competitionParticipants.registeredAt));

      res.status(HTTP_STATUS.OK).json(
        rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          registeredAt: r.registeredAt,
          user: { username: r.username || "Anonim", avatarUrl: r.avatarUrl },
        }))
      );
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: ERROR_MESSAGES.INTERNAL });
    }
  });

  // ============ ADMIN CONTROL PANEL ============

  /**
   * Admin ekanligini tekshirish uchun middleware.
   */
  const adminGuard = async (req: Request, res: Response, next: any) => {
    // 1-yo'l: server-server (bot) sir tokeni — x-bot-secret yoki x-admin-token.
    const secret = process.env.BOT_SECRET || process.env.ADMIN_API_TOKEN;
    const token = req.headers["x-bot-secret"] || req.headers["x-admin-token"];
    if (secret && token === secret) {
      return next();
    }

    // 2-yo'l: brauzer sessiyasi orqali admin foydalanuvchi.
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

  // ==========================================
  // 👑 ADMIN BOT UCHUN XAVFSIZ REST API
  // ==========================================
  
  // Xavfsizlik Middleware: Python admin-bot (x-bot-secret) YOKI brauzer session'idagi
  // admin foydalanuvchi (React admin panel). Ikkala yo'l ham qabul qilinadi.
  const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
    // 1-yo'l: server-server sir tokeni (Telegram bot).
    const token = req.headers["x-admin-token"] || req.headers["x-bot-secret"];
    const secret = process.env.BOT_SECRET || process.env.ADMIN_API_TOKEN;
    if (secret && token === secret) {
      return next();
    }

    // 2-yo'l: brauzer sessiyasi orqali admin (role='admin') — admin panel uchun.
    const currentUserId = req.session?.userId;
    if (currentUserId) {
      const currentUser = await storage.getUser(currentUserId);
      if (currentUser && currentUser.role === "admin") {
        return next();
      }
    }

    return res.status(403).json({ error: "Ruxsat etilmagan! (Forbidden)" });
  };

  // 1. STATISTIKANI OLISH
  app.get("/api/admin/stats", adminAuth, async (req, res) => {
    try {
      const [totalUsers] = await db.select({ count: sql`count(*)` }).from(users);
      const dailyActiveResult = await db.execute(sql`SELECT count(DISTINCT user_id) as count FROM test_results WHERE date(created_at) = current_date`);
      
      res.json({
        totalUsers: Number(totalUsers.count),
        activeToday: Number(dailyActiveResult.rows[0].count || 0),
        status: "ok"
      });
    } catch (error) {
      res.status(500).json({ error: "Statistikani olishda xatolik" });
    }
  });

  // ==========================================
  // OMMAVIY XABAR (BROADCAST) API
  // ==========================================
  app.post("/api/admin/broadcast", adminAuth, async (req, res) => {
    try {
      const { text, photoId, videoId } = req.body;
      
      // Barcha foydalanuvchilarning Telegram ID'larini bazadan tortib olamiz
      const allUsers = await db.execute(sql`SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL`);
      const userRows = allUsers.rows;
      
      if (!userRows || userRows.length === 0) {
        return res.status(404).json({ error: "Bazada foydalanuvchilar topilmadi" });
      }

      await writeAudit(req.session?.userId, "broadcast", null, {
        recipients: userRows.length, text: typeof text === "string" ? text.slice(0, 200) : undefined,
      });

      // API darhol javob berishi uchun "await" qilmasdan 200 OK qaytaramiz.
      res.status(200).json({ success: true, message: "Tarqatish orqa fonda boshlandi" });

      // ORQA FONDA XABAR TARQATISH LOGIKASI (BACKGROUND)
      const { getUserBot } = require("./userBot");
      const bot = getUserBot();
      if (!bot) {
        console.warn("User bot is not connected. Broadcast failed.");
        return;
      }

      const BATCH_SIZE = 25; // Telegram limitiga tushmaslik uchun (sekundiga max 30)
      
      for (let i = 0; i < userRows.length; i += BATCH_SIZE) {
        const batch = userRows.slice(i, i + BATCH_SIZE);
        
        const promises = batch.map(async (user: any) => {
          try {
              const tgId = Number(user.telegram_id);
              if (!tgId) throw new Error("Invalid telegram ID");

              // node-telegram-bot-api metodi
              if (photoId) {
                  return await bot.sendPhoto(tgId, photoId, { caption: text || "", parse_mode: 'HTML' });
              } else if (videoId) {
                  return await bot.sendVideo(tgId, videoId, { caption: text || "", parse_mode: 'HTML' });
              } else {
                  return await bot.sendMessage(tgId, text || "", { parse_mode: 'HTML' });
              }
          } catch (err: any) {
              console.error(`User ${user.telegram_id} ga xabar bormadi. Sababi:`, err.message);
              throw err; 
          }
        });

        // Bitta "batch"ni (25 kishiga) birdaniga jo'natish.
        await Promise.allSettled(promises);
        
        // Keyingi batch'ga o'tishdan oldin 1 sekund kutib turamiz (Rate limitdan saqlanish)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      
      console.log("✅ Ommaviy xabar barchaga muvaffaqiyatli tarqatildi!");

    } catch (error) {
      console.error("Broadcast API Xatosi:", error);
      if (!res.headersSent) {
          res.status(500).json({ error: "Serverda xatolik yuz berdi" });
      }
    }
  });

  // 1.5. FOYDALANUVCHINI BAN QILISH
  app.post("/api/admin/users/ban", adminAuth, async (req, res) => {
    try {
      const { userId, isBanned } = req.body;
      if (!userId) return res.status(400).json({ error: "userId talab qilinadi" });

      await storage.setUserBanned(userId, isBanned);
      res.json({ success: true, message: `Foydalanuvchi ${isBanned ? 'bloklandi' : 'blokdan chiqarildi'}` });
    } catch (error) {
      res.status(500).json({ error: "Foydalanuvchini ban qilishda xatolik" });
    }
  });

  // 3. MUSOBAQA QO'SHISH (Boshlang'ich)
  app.post("/api/admin/competitions", adminAuth, async (req, res) => {
    try {
      const { title, description, reward, startTime, endTime } = req.body;
      const [newComp] = await db.insert(competitions).values({
        title,
        description,
        reward,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        isActive: true
      }).returning();

      res.json(newComp);
    } catch (error) {
      res.status(500).json({ error: "Musobaqa qo'shishda xatolik" });
    }
  });

  // ==========================================
  // MUSOBAQALARNI KO'RISH VA O'CHIRISH
  // ==========================================
  
  // Faol musobaqalarni olish
  app.get("/api/admin/competitions", adminAuth, async (req, res) => {
    try {
      const activeComps = await db.select().from(competitions).where(eq(competitions.isActive, true));
      res.json(activeComps);
    } catch (error) {
      res.status(500).json({ error: "Musobaqalarni olishda xatolik" });
    }
  });

  // 4. XONA YARATISH KODLARINI GENERATSIYA QILISH (Admin bot uchun)
  app.post("/api/admin/creation-codes", adminAuth, async (req, res) => {
    try {
      const { code, maxParticipants, createdBy } = req.body;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 5); // 5 kunlik muddat

      const [newCode] = await db.insert(competitionCreationCodes).values({
        code,
        maxParticipants: parseInt(maxParticipants),
        createdBy: String(createdBy),
        isUsed: false,
        expiresAt: expiresAt
      }).returning();
      
      res.json(newCode);
    } catch (error) {
      console.error("Code Generation Error:", error);
      res.status(500).json({ error: "Kod yaratishda xatolik" });
    }
  });

  // Kod holatini tekshirish
  app.get("/api/admin/creation-codes/status/:code", adminAuth, async (req, res) => {
     try {
        const [codeEntry] = await db.select().from(competitionCreationCodes).where(eq(competitionCreationCodes.code, String(req.params.code)));
        if (!codeEntry) return res.status(404).json({ error: "Kod topilmadi" });

        let roomStatus = "inactive";
        if (codeEntry.activeBattleId) {
           const [battle] = await db.select().from(battles).where(eq(battles.id, codeEntry.activeBattleId));
           if (battle) roomStatus = battle.status;
        }

        res.json({
           ...codeEntry,
           roomStatus,
           isExpired: codeEntry.expiresAt ? new Date() > codeEntry.expiresAt : false
        });
     } catch (error) {
        res.status(500).json({ error: "Xatolik" });
     }
  });

  // Kodni o'chirish (deactivate)
  app.post("/api/admin/creation-codes/deactivate", adminAuth, async (req, res) => {
     try {
        const { code } = req.body;
        await db.update(competitionCreationCodes)
          .set({ isUsed: true, expiresAt: new Date(0) }) // Muddatini o'tmishga surib qo'yamiz
          .where(eq(competitionCreationCodes.code, code));
        
        res.json({ success: true });
     } catch (error) {
        res.status(500).json({ error: "Xatolik" });
     }
  });

  // ==========================================
  // 👥 FOYDALANUVCHILARNI BOSHQARISH
  // ==========================================
  
  // GET /api/admin/users/export
  app.get('/api/admin/users/export', adminAuth, async (req, res) => {
    try {
      // 1. Bazadan barcha foydalanuvchilarni olish
      const allUsers = await db.select().from(users);
      
      if (!allUsers || allUsers.length === 0) {
        return res.status(404).json({ error: "Bazada foydalanuvchilar topilmadi" });
      }

      // 2. CSV faylining sarlavhalari (Ustun nomlari)
      let csv = '\uFEFF'; // UTF-8 BOM qo'shamiz (Excelda rus/o'zbek harflari xatosiz chiqishi uchun)
      csv += 'ID,Telegram ID,Ism,Email,Rol,Yaratilgan sana\n';

      // 3. Har bir userni tsiklda aylanib, qatorlarga qo'shish
      allUsers.forEach((user: any) => {
        // FIX: users jadvalida `username` ustuni yo'q (firstName nickname sifatida
        // ishlatiladi). Ilgari user.username hamisha undefined edi. Email ishlatamiz.
        let name = user.firstName ? user.firstName.replace(/,/g, '') : 'Noma\'lum';
        let email = user.email ? user.email.replace(/,/g, '') : '-';
        const role = user.role || 'user';

        // Kiberxavfsizlik (CSV Injection / Formula Injection oldini olish)
        if (/^[=\-+\@]/.test(name)) name = "'" + name;
        if (/^[=\-+\@]/.test(email)) email = "'" + email;

        // Sanani chiroyli formatlash
        const date = user.createdAt ? new Date(user.createdAt).toLocaleString('ru-RU') : '-';

        csv += `${user.id},"${user.telegramId}","${name}","${email}","${role}","${date}"\n`;
      });

      // 4. Brauzer yoki Bot buni oddiy JSON emas, fayl deb qabul qilishi uchun Headerlarni sozlaymiz
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="yozgo_foydalanuvchilar.csv"');
      
      // Matnni yuboramiz (U avtomat faylga aylanadi)
      res.send(csv);

    } catch (error) {
      console.error("Export API xatosi:", error);
      res.status(500).json({ error: "Server xatosi" });
    }
  });

  // 1. Top 10 foydalanuvchini olish (WPM bo'yicha)
  app.get("/api/admin/users/top", adminAuth, async (req, res) => {
    try {
      // Eng ko'p test topshirgan yoki eng yuqori role ega 10 ta foydalanuvchini olish (namuna uchun)
      const topUsers = await db.select(safeUserColumns).from(users).limit(10);
      res.json(topUsers);
    } catch (error) {
      res.status(500).json({ error: "Foydalanuvchilarni olishda xatolik" });
    }
  });

  // 2. Foydalanuvchini qidirish (ID bo'yicha yoki email/ismi bo'yicha)
  app.get("/api/admin/users/search/:query", adminAuth, async (req, res) => {
    try {
      const q = `%${req.params.query}%`;
      
      const foundUsers = await db.select(safeUserColumns).from(users).where(
        sql`${users.id}::text = ${req.params.query}
            OR ${users.firstName} ILIKE ${q} 
            OR ${users.lastName} ILIKE ${q} 
            OR ${users.email} ILIKE ${q} 
            OR ${users.telegramId}::text = ${req.params.query}`
      ).limit(10);
      
      res.json(foundUsers);
    } catch (error) {
      console.error("Search Error:", error);
      res.status(500).json({ error: "Qidirishda xatolik" });
    }
  });

  app.get("/api/admin/users/:id", adminAuth, async (req, res) => {
    try {
      const userId = req.params.id as string;
      const [user] = await db.select(safeUserColumns).from(users).where(eq(users.id, userId));

      if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Qidirishda xatolik" });
    }
  });

  // ==========================================
  // ⚙️ SOZLAMALAR (SYSTEM SETTINGS)
  // ==========================================
  
  // Barcha sozlamalarni olish
  app.get("/api/admin/settings", adminAuth, async (req, res) => {
    try {
      const settings = await db.select().from(systemSettings);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Sozlamalarni olishda xatolik" });
    }
  });

  // Sozlamani o'zgartirish yoki qo'shish (Upsert)
  app.post("/api/admin/settings", adminAuth, async (req, res) => {
    try {
      const { key, value } = req.body;
      
      await db.insert(systemSettings)
        .values({ key, value })
        .onConflictDoUpdate({ 
          target: systemSettings.key, 
          set: { value } 
        });
        
      res.json({ success: true, key, value });
    } catch (error) {
      res.status(500).json({ error: "Sozlamani saqlashda xatolik" });
    }
  });

  // 3. Ban / Unban qilish (Toggle)
  app.post("/api/admin/users/:id/toggle-ban", adminAuth, async (req, res) => {
    try {
      const userId = req.params.id as string;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) return res.status(404).json({ error: "Topilmadi" });

      const updatedUser = await db.update(users)
        .set({ isBanned: !user.isBanned })
        .where(eq(users.id, userId))
        .returning();

      await writeAudit(req.session?.userId, user.isBanned ? "unban" : "ban", userId, {
        email: user.email, from: user.isBanned, to: !user.isBanned,
      });

      res.json({ success: true, user: updatedUser[0] });
    } catch (error) {
      res.status(500).json({ error: "Ban qilishda xatolik" });
    }
  });

  // Musobaqani o'chirish
  app.delete("/api/admin/competitions/:id", adminAuth, async (req, res) => {
    try {
      const compId = req.params.id as any;
      await db.delete(competitions).where(eq(competitions.id, compId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Musobaqani o'chirishda xatolik" });
    }
  });

  // ==========================================
  // 👤 USER DETAIL + TAHRIR + GRANT (gamification)
  // ==========================================

  // QADAM 2: to'liq user detali — xp/level/coins/streak + badges + league + oxirgi 10 natija.
  app.get("/api/admin/users/:id/detail", adminAuth, async (req, res) => {
    try {
      const uid = req.params.id as string;
      const [u] = await db.select().from(users).where(eq(users.id, uid));
      if (!u) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });

      const userBadgeRows = await db
        .select({ key: badges.key, icon: badges.icon, earnedAt: userBadges.earnedAt })
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.id))
        .where(eq(userBadges.userId, uid));

      const [league] = await db
        .select({ tier: leagueMembers.leagueTier, weeklyXp: leagueMembers.weeklyXp, name: leagues.name, icon: leagues.icon })
        .from(leagueMembers)
        .leftJoin(leagues, eq(leagueMembers.leagueTier, leagues.tier))
        .where(eq(leagueMembers.userId, uid));

      const recentResults = await db
        .select({ wpm: testResults.wpm, accuracy: testResults.accuracy, mode: testResults.mode, language: testResults.language, source: testResults.source, createdAt: testResults.createdAt })
        .from(testResults)
        .where(eq(testResults.userId, uid))
        .orderBy(desc(testResults.createdAt))
        .limit(10);

      res.json({
        id: u.id, email: u.email, firstName: u.firstName, role: u.role, gender: u.gender,
        isBanned: u.isBanned, xp: u.xp, level: u.level, coins: u.coins,
        currentStreak: u.currentStreak, longestStreak: u.longestStreak, createdAt: u.createdAt,
        badges: userBadgeRows,
        league: league || null,
        recentResults,
      });
    } catch (error) {
      console.error("[ADMIN] user detail xato:", error);
      res.status(500).json({ error: "Detalni olishda xatolik" });
    }
  });

  // QADAM 2: xp/coins ni admin qo'lda o'rnatish (absolute). Level xp'dan qayta hisoblanadi.
  app.patch("/api/admin/users/:id", adminAuth, async (req, res) => {
    try {
      const uid = req.params.id as string;
      const { xp, coins } = req.body ?? {};
      const [before] = await db.select().from(users).where(eq(users.id, uid));
      if (!before) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });

      const set: Record<string, any> = { updatedAt: new Date() };
      if (xp !== undefined) {
        const nx = Math.floor(Number(xp));
        if (!Number.isFinite(nx) || nx < 0) return res.status(400).json({ error: "xp >= 0 bo'lishi kerak" });
        set.xp = nx;
        set.level = levelForXp(nx);
      }
      if (coins !== undefined) {
        const nc = Math.floor(Number(coins));
        if (!Number.isFinite(nc) || nc < 0) return res.status(400).json({ error: "coins >= 0 bo'lishi kerak" });
        set.coins = nc;
      }
      const [after] = await db.update(users).set(set).where(eq(users.id, uid)).returning();

      await writeAudit(req.session?.userId, "edit_user", uid, {
        email: before.email,
        before: { xp: before.xp, level: before.level, coins: before.coins },
        after: { xp: after.xp, level: after.level, coins: after.coins },
      });
      res.json({ success: true, user: { id: after.id, xp: after.xp, level: after.level, coins: after.coins } });
    } catch (error) {
      console.error("[ADMIN] user edit xato:", error);
      res.status(500).json({ error: "Tahrirlashda xatolik" });
    }
  });

  // QADAM 3: coin/xp/badge berish. body: {type:'coins'|'xp'|'badge', amount?, badgeId?, reason?}
  app.post("/api/admin/users/:id/grant", adminAuth, async (req, res) => {
    try {
      const uid = req.params.id as string;
      const { type, amount, badgeId, reason } = req.body ?? {};
      const [u] = await db.select().from(users).where(eq(users.id, uid));
      if (!u) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });

      if (type === "coins") {
        const amt = Math.floor(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "amount > 0 bo'lishi kerak" });
        await db.update(users).set({ coins: sql`${users.coins} + ${amt}`, updatedAt: new Date() }).where(eq(users.id, uid));
        await writeAudit(req.session?.userId, "grant_coins", uid, { email: u.email, amount: amt, reason });
        return res.json({ success: true, type, amount: amt });
      }
      if (type === "xp") {
        const amt = Math.floor(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "amount > 0 bo'lishi kerak" });
        const result = await storage.addUserXp(uid, amt);
        await writeAudit(req.session?.userId, "grant_xp", uid, { email: u.email, amount: amt, newXp: result.xp, newLevel: result.level, reason });
        return res.json({ success: true, type, amount: amt, ...result });
      }
      if (type === "badge") {
        if (!badgeId) return res.status(400).json({ error: "badgeId kerak" });
        const [badge] = await db.select().from(badges).where(eq(badges.id, badgeId));
        if (!badge) return res.status(404).json({ error: "Badge topilmadi" });
        await db.insert(userBadges).values({ userId: uid, badgeId }).onConflictDoNothing();
        await writeAudit(req.session?.userId, "grant_badge", uid, { email: u.email, badgeKey: badge.key, reason });
        return res.json({ success: true, type, badgeKey: badge.key });
      }
      return res.status(400).json({ error: "type: coins|xp|badge" });
    } catch (error) {
      console.error("[ADMIN] grant xato:", error);
      res.status(500).json({ error: "Berishda xatolik" });
    }
  });

  // Badge katalogi (grant UI uchun).
  app.get("/api/admin/badges", adminAuth, async (_req, res) => {
    try {
      const rows = await db.select().from(badges).orderBy(badges.sortOrder);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Badge katalogini olishda xatolik" });
    }
  });

  // QADAM 4: barcha ligalar + a'zolari (weekly_xp bo'yicha reyting).
  app.get("/api/admin/leagues", adminAuth, async (_req, res) => {
    try {
      const leagueRows = await db.select().from(leagues).orderBy(leagues.tier);
      const members = await db
        .select({ tier: leagueMembers.leagueTier, weeklyXp: leagueMembers.weeklyXp, email: users.email, firstName: users.firstName })
        .from(leagueMembers)
        .leftJoin(users, eq(leagueMembers.userId, users.id))
        .orderBy(desc(leagueMembers.weeklyXp));
      const byTier = leagueRows.map((lg: any) => ({
        ...lg,
        members: members.filter((m: any) => m.tier === lg.tier),
      }));
      res.json(byTier);
    } catch (error) {
      console.error("[ADMIN] leagues xato:", error);
      res.status(500).json({ error: "Ligalarni olishda xatolik" });
    }
  });

  // QADAM 5: oxirgi janglar + natijalari.
  app.get("/api/admin/battles", adminAuth, async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
      const battleRows = await db.select().from(battles).orderBy(desc(battles.createdAt)).limit(limit);
      const ids = battleRows.map((b: any) => b.id);
      let parts: any[] = [];
      if (ids.length) {
        parts = await db
          .select({ battleId: battleParticipants.battleId, email: users.email, firstName: users.firstName, wpm: battleParticipants.wpm, accuracy: battleParticipants.accuracy, isWinner: battleParticipants.isWinner, xpAwarded: battleParticipants.xpAwarded, coinsAwarded: battleParticipants.coinsAwarded })
          .from(battleParticipants)
          .leftJoin(users, eq(battleParticipants.userId, users.id))
          .where(inArray(battleParticipants.battleId, ids));
      }
      const result = battleRows.map((b: any) => ({
        id: b.id, code: b.code, status: b.status, language: b.language, mode: b.mode,
        createdAt: b.createdAt, participants: parts.filter((p) => p.battleId === b.id),
      }));
      res.json(result);
    } catch (error) {
      console.error("[ADMIN] battles xato:", error);
      res.status(500).json({ error: "Janglarni olishda xatolik" });
    }
  });

  // QADAM 6: audit log — oxirgi 100 amal.
  app.get("/api/admin/audit-log", adminAuth, async (_req, res) => {
    try {
      const rows = await db
        .select({ id: adminAuditLog.id, action: adminAuditLog.action, details: adminAuditLog.details, createdAt: adminAuditLog.createdAt, adminEmail: users.email })
        .from(adminAuditLog)
        .leftJoin(users, eq(adminAuditLog.adminId, users.id))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(100);
      res.json(rows);
    } catch (error) {
      console.error("[ADMIN] audit-log xato:", error);
      res.status(500).json({ error: "Auditni olishda xatolik" });
    }
  });

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
