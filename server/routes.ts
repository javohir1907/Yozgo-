import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertTestResultSchema, insertBattleSchema, insertReviewSchema, insertCompetitionSchema, insertAdvertisementSchema } from "@shared/schema";
import { BattleManager } from "./battle-manager";
import { setupAuth, isAuthenticated } from "./auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
        period: z.enum(["daily", "weekly", "alltime"]).default("alltime"),
        language: z.enum(["en", "ru", "uz"]).default("en"),
      });

      const query = querySchema.parse(req.query);
      const entries = await storage.getLeaderboard(query.period, query.language);
      
      const transformedEntries = entries.map((entry, index) => ({
        rank: index + 1,
        username: entry.user.firstName || entry.user.email?.split('@')[0] || "Unknown",
        avatarUrl: entry.user.profileImageUrl,
        wpm: entry.wpm,
        accuracy: entry.accuracy,
        language: entry.language,
        date: new Date(entry.updatedAt).toLocaleDateString(),
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
          username: user.firstName || user.email?.split('@')[0] || "Anonymous",
          avatarUrl: user.profileImageUrl,
        },
        stats,
        recentResults,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/battles", async (req, res) => {
    try {
      const data = insertBattleSchema.parse(req.body);
      const battle = await storage.createBattle(data);
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

  // Reviews
  app.get("/api/reviews", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const reviews = await storage.getRecentReviews(limit);
      
      const transformed = reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: {
          username: r.user.firstName || r.user.email?.split('@')[0] || "Unknown",
          avatarUrl: r.user.profileImageUrl,
        }
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

  // Admin middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    next();
  };

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
        endDate: new Date(req.body.endDate)
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

  app.delete("/api/admin/advertisements/:id", isAdmin, async (req, res) => {
    try {
      const ad = await storage.toggleAdvertisement(req.params.id, false);
      res.json(ad);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
