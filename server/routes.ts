import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertTestResultSchema, insertBattleSchema } from "@shared/schema";
import { BattleManager } from "./battle-manager";
import { setupAuth, isAuthenticated } from "./replit_integrations/auth/replitAuth";
import { registerAuthRoutes } from "./replit_integrations/auth/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  const battleManager = new BattleManager(httpServer);

  // Protected route example: results/me
  app.get("/api/results/me", isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    // req.user in Replit Auth has claims.sub as the ID
    const userId = user.claims.sub;

    try {
      const results = await storage.getTestResultsByUserId(userId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/results", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = user.claims.sub;

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

  // Leaderboard API
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const querySchema = z.object({
        period: z.enum(["daily", "weekly", "alltime"]).default("alltime"),
        language: z.enum(["en", "ru", "uz"]).default("en"),
      });

      const query = querySchema.parse(req.query);
      const entries = await storage.getLeaderboard(query.period, query.language);
      
      // Transform for frontend LeaderboardTable
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

  // User Profile and Statistics
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

  // Battle API
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

  return httpServer;
}
