import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertTestResultSchema,
  insertBattleSchema,
  insertReviewSchema,
  insertCompetitionSchema,
  insertAdvertisementSchema,
} from "@shared/schema";
import { BattleManager } from "./battle-manager";
import { setupAuth, isAuthenticated } from "./auth";
import { db } from "./db";
import { eq, sql, desc, and, ne } from "drizzle-orm";
import { testResults, users, battles, roomAccessCodes, battleParticipants, competitions, advertisements, notifications, competitionParticipants } from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  const battleManager = new BattleManager(httpServer);

  app.get("/api/results/me", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;

    try {
      const results = await storage.getTestResultsByUserId(userId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/results", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;

      const data = insertTestResultSchema.parse({ ...req.body, userId });
      const result = await storage.createTestResult(data);

      await storage.updateLeaderboardEntry({
        userId,
        wpm: data.wpm,
        accuracy: data.accuracy,
        language: data.language,
        period: "alltime",
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid test results data" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const querySchema = z.object({
        language: z.enum(["all", "en", "ru", "uz"]).default("all"),
      });

                  
      const query = querySchema.parse(req.query);

      let conditions = undefined;
      if (query.language !== "all") {
        conditions = eq(testResults.language, query.language);
      }

      const rawRows = await db
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
        .where(conditions)
        .groupBy(testResults.userId, users.id, users.firstName, users.email, users.profileImageUrl)
        .orderBy(desc(sql`max(${testResults.wpm})`));

      const transformedEntries = rawRows.map((u, index) => ({
        rank: index + 1,
        userId: u.userId,
        username: u.username || u.email?.split("@")[0] || "Unknown",
        avatarUrl: u.avatarUrl,
        avgWpm: u.avgWpm,
        bestWpm: u.bestWpm,
        accuracy: u.accuracy,
        testCount: u.testCount,
        totalSeconds: u.totalSeconds,
      }));

      res.json(transformedEntries);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid query parameters" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const stats = await storage.getUserStats(userId);
      const recentResults = await storage.getTestResultsByUserId(userId);

      res.json({
        user: {
          id: user.id,
          username: user.firstName || user.email?.split("@")[0] || "Anonymous",
          avatarUrl: user.profileImageUrl,
        },
        stats,
        recentResults,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/battles", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const data = insertBattleSchema.parse(req.body);

      const battleData = { ...data, creatorId: userId };
      const battle = await storage.createBattle(battleData);

      try {
        const { sendRoomCreatedMessage } = require("./bot");
        sendRoomCreatedMessage(battle.code);
      } catch (e) {}

      res.status(201).json(battle);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid battle data" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/battles/:code", async (req, res) => {
    try {
      const battle = await storage.getBattleByCode(req.params.code);
      if (!battle) {
        return res.status(404).json({ message: "Battle not found" });
      }

      const participants = await storage.getBattleParticipants(battle.id);
      res.json({ ...battle, participants });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const ipCache = new Map<string, any>();
  app.post("/api/battles/validate-code", isAuthenticated, async (req, res) => {
    try {
                        const { battleCode } = req.body;
      const userId = (req.session as any).userId;

      let battle = await storage.getBattleByCode(battleCode);
      let isAccessCode = false;

      // AccessCode tekshirish
      const [foundCode] = await db
        .select()
        .from(roomAccessCodes)
        .where(eq(roomAccessCodes.code, battleCode));
      if (foundCode) {
        if (foundCode.isUsed) {
          return res.status(400).json({ message: "Bu kod allaqachon foydalanilgan." });
        }
        isAccessCode = true;
        const [foundBattle] = await db
          .select()
          .from(battles)
          .where(eq(battles.id, foundCode.roomId));
        battle = foundBattle;
      }

      if (!battle) {
        return res.status(404).json({ message: "Xona yoki kirish kodi topilmadi." });
      }

      // Agar foydalanuvchi Asosiy xona kodini kiritmoqchi bo'lsa va xonada bot orqali kirish yoniq bo'lsa (code bor bo'lsa):
      if (!isAccessCode) {
        // Individual xonaga kirish yopiladi! (Admindan tashqari hamma Majburiy Telegram bot ishlatishi shart)
        // Adminlarga ulab bo'lmaydi chunki admin createBattle() da avtomatik websockets dan kiradi!
        // Demak user quticha orqali kiryapsa OHSVEW deb yozishi taqiqlanadi!
        return res
          .status(403)
          .json({
            message:
              "Siz musobaqa xonasining asosiy kodini kiritdingiz. \nXonaga qo'shilish uchun @yozgo_bot orqali aynan o'sha kodni yuboring va individual uzun kodingizni oling!",
          });
      }

      res.status(200).json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Xatolik" });
    }
  });

  app.post("/api/battles/join", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { battleCode, agreed } = req.body;

      if (!agreed) {
        return res.status(400).json({ message: "Shartlarga rozi bo'lishingiz shart." });
      }

                  
      let battle = await storage.getBattleByCode(battleCode);
      let isAccessCode = false;
      let codeEntry = null;

      // AccessCode bo'lsa uni izlaymiz:
      const [foundCode] = await db
        .select()
        .from(roomAccessCodes)
        .where(eq(roomAccessCodes.code, battleCode));
      if (foundCode) {
        isAccessCode = true;
        codeEntry = foundCode;
        const [foundBattle] = await db
          .select()
          .from(battles)
          .where(eq(battles.id, foundCode.roomId));
        battle = foundBattle;
      }

      if (!battle) {
        return res.status(404).json({ message: "Xona yoki kirish kodi topilmadi." });
      }

      // Asosiy kod bilan kirish umuman taqiqlanadi
      if (!isAccessCode) {
        return res
          .status(403)
          .json({
            message:
              "Siz musobaqa xonasining asosiy kodini kiritdingiz. \nXonaga qo'shilish uchun @yozgo_bot orqali aynan o'sha kodni yuboring va individual uzun kodingizni oling!",
          });
      }

      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      const ipStr = Array.isArray(ip) ? ip[0] : ip;

      // 1. IP and VPN Check
      if (ipStr !== "127.0.0.1" && ipStr !== "::1" && ipStr !== "unknown") {
        let ipData = ipCache.get(ipStr);
        if (!ipData) {
          try {
            const resp = await fetch(`http://ip-api.com/json/${ipStr}?fields=proxy,hosting,vpn`);
            if (resp.ok) {
              ipData = await resp.json();
              ipCache.set(ipStr, ipData);
            }
          } catch (e) {}
        }

        if (ipData && (ipData.proxy || ipData.hosting || ipData.vpn)) {
          return res
            .status(403)
            .json({
              message: "VPN yoki Proxy aniqlandi. Iltimos o'chiring va qayta urinib ko'ring.",
            });
        }

        // Check if IP is already used by another user in this room
        const existingIpUsers = await db
          .select()
          .from(battleParticipants)
          .where(
            and(eq(battleParticipants.battleId, battle.id), eq(battleParticipants.ipAddress, ipStr))
          );

        const otherUserSameIp = existingIpUsers.find((p) => p.userId !== userId);
        if (otherUserSameIp) {
          try {
            const { sendBotMessage } = await import("./bot");
            const [user1] = await db.select().from(users).where(eq(users.id, userId));
            const [user2] = await db
              .select()
              .from(users)
              .where(eq(users.id, otherUserSameIp.userId));
            sendBotMessage(
              `🚫 Bir xil IP dan 2 akkaunt urinishi:\nIP: ${ipStr}\nUser 1: ${user1?.firstName || user1?.email}\nUser 2: ${user2?.firstName || user2?.email}`
            );
          } catch (e) {}
          return res
            .status(403)
            .json({
              message: "Ushbu IP orqali boshqa foydalanuvchi xonaga kirgan. Qoidalar buzildi.",
            });
        }
      }

      // 2. Individual Code Check
      if (isAccessCode && codeEntry) {
        if (codeEntry.isUsed) {
          return res.status(400).json({ message: "Bu kod allaqachon foydalanilgan." });
        }

        await db
          .update(roomAccessCodes)
          .set({ isUsed: true, usedAt: new Date() })
          .where(eq(roomAccessCodes.id, codeEntry.id));
      }

      // Add or update participant
      const existingPart = await db
        .select()
        .from(battleParticipants)
        .where(
          and(eq(battleParticipants.battleId, battle.id), eq(battleParticipants.userId, userId))
        );

      if (existingPart.length === 0) {
        await db.insert(battleParticipants).values({
          battleId: battle.id,
          userId,
          ipAddress: ipStr,
          agreedAt: new Date(),
        });
      } else {
        await db
          .update(battleParticipants)
          .set({ ipAddress: ipStr, agreedAt: new Date() })
          .where(eq(battleParticipants.id, existingPart[0].id));
      }

      res.status(200).json({ success: true, roomCode: battle.code });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reviews
  app.get("/api/reviews", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const reviews = await storage.getRecentReviews(limit);

      const transformed = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: {
          username: r.user.firstName || r.user.email?.split("@")[0] || "Unknown",
          avatarUrl: r.user.profileImageUrl,
        },
      }));
      res.json(transformed);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const data = insertReviewSchema.parse({ ...req.body, userId });
      const review = await storage.createReview(data);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid review data" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Competitions
  app.get("/api/competitions", async (req, res) => {
    try {
      const comps = await storage.getActiveCompetitions();
      res.json(comps);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/competitions/all", async (req, res) => {
    try {
                        const comps = await db.select().from(competitions).orderBy(desc(competitions.createdAt));
      res.json(comps);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/advertisements", async (req, res) => {
    try {
                        const ads = await db.select().from(advertisements).where(eq(advertisements.isActive, true));
      res.json(ads);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/competitions/:id/register", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId as string;
      const compId = req.params.id as string;
                  
      const existing = await db
        .select()
        .from(competitionParticipants)
        .where(
          and(
            eq(competitionParticipants.competitionId, compId),
            eq(competitionParticipants.userId, userId)
          )
        );

      if (existing.length > 0) {
        return res.status(400).json({ message: "Siz allaqachon ro'yxatdan o'tgansiz!" });
      }

      await db.insert(competitionParticipants).values({
        competitionId: compId,
        userId: userId,
      });
      await db
        .update(competitions)
        .set({ participantsCount: sql`${competitions.participantsCount} + 1` })
        .where(eq(competitions.id, compId));

      res.status(200).json({ message: "Ro'yxatdan muvaffaqiyatli o'tdingiz!" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications", async (req, res) => {
    try {
                        const notifs = await db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      res.json(notifs);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    if (
      req.headers["x-bot-secret"] &&
      process.env.BOT_SECRET &&
      req.headers["x-bot-secret"] === process.env.BOT_SECRET
    ) {
      return next();
    }
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    next();
  };

  app.get("/api/admin/bot-stats", isAdmin, async (req, res) => {
    try {
            
      const totalUsers = await db.execute(sql`SELECT count(*) FROM users`);
      const todayUsers = await db.execute(
        sql`SELECT count(*) FROM users WHERE date(created_at) = current_date`
      );
      const activeBattles = await db.execute(
        sql`SELECT count(*) FROM battles WHERE status IN ('waiting', 'playing')`
      );
      const todayTests = await db.execute(
        sql`SELECT count(*), COALESCE(round(avg(wpm)), 0) as avg_wpm FROM test_results WHERE date(created_at) = current_date`
      );

      res.json({
        totalUsers: Number(totalUsers.rows[0].count),
        todayUsers: Number(todayUsers.rows[0].count),
        activeBattles: Number(activeBattles.rows[0].count),
        todayTests: Number(todayTests.rows[0].count),
        avgWpm: Number(todayTests.rows[0].avg_wpm),
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/competitions", isAdmin, async (req, res) => {
    try {
      const data = insertCompetitionSchema.parse({ ...req.body, date: new Date(req.body.date) });
      const comp = await storage.createCompetition(data);
      res.status(201).json(comp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid competition data" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/admin/bot-competitions", isAdmin, async (req, res) => {
    try {
                        const list = await db.select().from(competitions).orderBy(desc(competitions.createdAt));
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/admin/competitions/:id/tugat", isAdmin, async (req, res) => {
    try {
                        const { winnerName } = req.body;
      const [updated] = await db
        .update(competitions)
        .set({ isActive: false, winnerName })
        .where(eq(competitions.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Advertisements
  app.get("/api/advertisements", async (req, res) => {
    try {
      const ads = await storage.getActiveAdvertisements();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/advertisements", isAdmin, async (req, res) => {
    try {
      const ads = await storage.getAllAdvertisements();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/advertisements", isAdmin, async (req, res) => {
    try {
      const data = insertAdvertisementSchema.parse({
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      });
      const ad = await storage.createAdvertisement(data);
      res.status(201).json(ad);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid ad data" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.put("/api/admin/advertisements/:id/toggle", isAdmin, async (req, res) => {
    try {
      const ad = await storage.toggleAdvertisement(req.params.id, req.body.isActive);
      res.json(ad);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/advertisements/:id/click", async (req, res) => {
    try {
      await storage.trackAdClick(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
