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
import { eq, sql, desc, and } from "drizzle-orm";

import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated } from "./auth";
import { BattleManager } from "./battle-manager";
import { sendAdminNotification } from "./utils/notifier";
import { LeaderboardService } from "./services/leaderboard.service";

// Shared Schemas & Models
import crypto from "crypto";

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
  systemSettings,
  competitionCreationCodes,
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

      // ANTI-CHEAT: Absolute limit check
      if (validatedData.wpm > 260) {
        console.warn(`🚨 [LIMIT] Manual Result: User ${userId} exceeded WPM limit: ${validatedData.wpm}`);
        return res.status(HTTP_STATUS.FORBIDDEN).json({ message: "Sizning natijangiz shubhali deb topildi. Iltimos, halol o'ynang!" });
      }

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
      if (language === "all" && leaderboardCache.data && Date.now() - leaderboardCache.lastFetched < CACHE_TTL) {
        return res.status(HTTP_STATUS.OK).json(leaderboardCache.data);
      }

      // Toza Arxitektura: DB va Mantiq Service'ga topshirildi
      const formattedEntries = await LeaderboardService.getLeaderboardData(language);

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
          gender: userRecord.gender, // Yangi qo'shilgan maydon
          role: userRecord.role,
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
          }
        },
        recentResults: recentAttempts.slice(0, 20), // Oxirgi 20 ta natija chart uchun
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

      const adminEmailsStr = process.env.ADMIN_EMAILS || "xolmatovjavohir911@gmail.com,xolmatovjavohir812@gmail.com";
      const adminEmails = adminEmailsStr.split(",").map(e => e.trim().toLowerCase());
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
      res.status(HTTP_STATUS.INTERNAL_ERROR).json({ message: error?.message || ERROR_MESSAGES.INTERNAL, stack: error?.stack });
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
      if (!matchedBattle) {
        const [creationCodeEntry] = await db.select().from(competitionCreationCodes)
          .where(eq(competitionCreationCodes.code, battleCode));

        if (creationCodeEntry) {
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

      // 🚨 QAT'IY JINS TEKSHIRUVI (ANTI-HACK)
      if (matchedBattle.genderRestriction !== 'all') {
        const [userRecord] = await db.select().from(users).where(eq(users.id, userId));
        
        if (!userRecord) {
          return res.status(HTTP_STATUS.UNAUTHORIZED).json({ message: ERROR_MESSAGES.UNAUTHORIZED });
        }
        
        if (!userRecord.gender) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
            message: "Profilingizda jinsingiz ko'rsatilmagan. Xonaga kirish uchun avval profildan jinsingizni belgilang!" 
          });
        }

        if (userRecord.gender !== matchedBattle.genderRestriction) {
          const requiredGender = matchedBattle.genderRestriction === 'male' ? "Yigitlar 🧍‍♂️" : "Qizlar 🧍‍♀️";
          return res.status(HTTP_STATUS.FORBIDDEN).json({ 
            message: `🚫 Kechirasiz, qoidaga muvofiq ushbu xona faqat ${requiredGender} uchun mo'ljallangan!` 
          });
        }
      }
      // ====================================================

      const isAccessCode = !!accessCodeEntry || !!creationCodeEntry;
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

  // ==========================================
  // 👑 ADMIN BOT UCHUN XAVFSIZ REST API
  // ==========================================
  
  // Xavfsizlik Middleware: Faqat Python botdan kelgan so'rovlarni o'tkazadi
  const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers["x-admin-token"] || req.headers["x-bot-secret"];
    const secret = process.env.BOT_SECRET || process.env.ADMIN_API_TOKEN;
    
    if (!secret || token !== secret) {
      return res.status(403).json({ error: "Ruxsat etilmagan! (Forbidden)" });
    }
    next();
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

  // 2. REKLAMA QO'SHISH
  app.post("/api/admin/ads", adminAuth, async (req, res) => {
    try {
      const { title, imageUrl, linkUrl, durationDays } = req.body;
      
      // Tugash vaqtini hisoblash
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));

      const [newAd] = await db.insert(advertisements).values({
        title,
        imageUrl,
        linkUrl,
        durationDays: parseInt(durationDays),
        expiresAt,
        isActive: true
      }).returning();

      res.json(newAd);
    } catch (error) {
      res.status(500).json({ error: "Reklama qo'shishda xatolik" });
    }
  });

  // ==========================================
  // REKLAMALARNI KO'RISH VA O'CHIRISH
  // ==========================================
  
  // Faol reklamalarni olish
  app.get("/api/admin/ads/all", adminAuth, async (req, res) => {
    try {
      const activeAds = await db.select().from(advertisements).where(eq(advertisements.isActive, true));
      res.json(activeAds);
    } catch (error) {
      res.status(500).json({ error: "Reklamalarni olishda xatolik" });
    }
  });

  // Reklamani o'chirish
  app.delete("/api/admin/ads/:id", adminAuth, async (req, res) => {
    try {
      const adId = req.params.id as string;
      await db.delete(advertisements).where(eq(advertisements.id, adId as any));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Reklamani o'chirishda xatolik" });
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
        const [codeEntry] = await db.select().from(competitionCreationCodes).where(eq(competitionCreationCodes.code, req.params.code));
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
      csv += 'ID,Telegram ID,Ism,Username,Rol,Yaratilgan sana\n';
      
      // 3. Har bir userni tsiklda aylanib, qatorlarga qo'shish
      allUsers.forEach((user: any) => {
        // Ism va usernamedagi ehtimoliy vergullarni bo'sh joyga almashtiramiz (CSV strukturasi buzilmasligi uchun)
        let name = user.firstName ? user.firstName.replace(/,/g, '') : 'Noma\'lum';
        let username = user.username ? user.username.replace(/,/g, '') : '-';
        const role = user.role || 'user';
        
        // Kiberxavfsizlik (CSV Injection / Formula Injection oldini olish)
        if (/^[=\-+\@]/.test(name)) name = "'" + name;
        if (/^[=\-+\@]/.test(username)) username = "'" + username;
        
        // Sanani chiroyli formatlash
        const date = user.createdAt ? new Date(user.createdAt).toLocaleString('ru-RU') : '-';
        
        csv += `${user.id},"${user.telegramId}","${name}","${username}","${role}","${date}"\n`;
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
      const topUsers = await db.select().from(users).limit(10);
      res.json(topUsers);
    } catch (error) {
      res.status(500).json({ error: "Foydalanuvchilarni olishda xatolik" });
    }
  });

  // 2. Foydalanuvchini qidirish (ID bo'yicha yoki email/ismi bo'yicha)
  app.get("/api/admin/users/search/:query", adminAuth, async (req, res) => {
    try {
      const q = `%${req.params.query}%`;
      
      const foundUsers = await db.select().from(users).where(
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
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
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
