import { type Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { BattleManager } from "./battle-manager";
import debugRouter from "./debug-auth";

export async function registerRoutes(app: Express): Promise<Server> {
    setupAuth(app);

  if (process.env.NODE_ENV !== "production") {
        app.use("/api", debugRouter);
  }

  app.get("/api/battles", async (_req, res) => {
        const battles = await storage.getBattles();
        res.json(battles);
  });

  app.post("/api/battles", async (req, res) => {
        if (!req.isAuthenticated()) return res.sendStatus(401);
        const battle = await storage.createBattle({
                ...req.body,
                creatorId: req.user.id,
                status: "waiting",
        });
        res.status(201).json(battle);
  });

  const httpServer = createServer(app);
    new BattleManager(httpServer);
    return httpServer;
}
