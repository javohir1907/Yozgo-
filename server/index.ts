/**
 * YOZGO - Main Server Entry Point
 * 
 * Ushbu fayl Express serverini, xavfsizlik choralarini (Helmet),
 * Ma'lumotlar bazasi migratsiyalarini va botlarni ishga tushiradi.
 * 
 * @author YOZGO Team
 * @version 1.2.0
 */

// ============ IMPORTS ============
import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "http";
import helmet from "helmet";

import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { pool } from "./db";
import { setupSwagger } from "./swagger";
import debugRouter from "./debug-auth";

/**
 * Global HTTP turlarini kengaytirish
 */
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ============ INITIALIZATION ============
const app = express();
const httpServer: Server = createServer(app);
const PORT = parseInt(process.env.PORT || "5000", 10);

// ============ PROCESS HANDLERS ============
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  console.error("[CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error: Error) => {
  console.error("[CRITICAL] Uncaught Exception:", error);
});

// ============ MIDDLEWARES & SECURITY ============

/**
 * Helmet: Xavfsizlik sarlavhalarini sozlash (CSP, HSTS, Frameguard)
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https://yozgo.uz"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://yozgo.uz"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://yozgo.uz", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "https://yozgo.uz"],
        connectSrc: ["'self'", "wss:", "ws:", "https:", "http:", "https://yozgo.uz"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        frameAncestors: ["'none'"],
        requireTrustedTypesFor: ["'script'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: "deny",
    },
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 200, // Har bir IP uchun 15 daqiqada 200 ta so'rov
  message: "Juda ko'p so'rov yuborildi. Iltimos, birozdan so'ng qayta urinib ko'ring.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 soat
  max: 20, // 1 soatda 20 ta urinish
  message: "Juda ko'p avtorizatsiya urinishlari.",
});

app.use("/api/", apiLimiter);
app.use("/api/auth/", authLimiter);

// Maxfiy ma'lumotlarni ruxsat etish siyosati
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

/**
 * CORS: Tashqi domendan so'rovlarni boshqarish
 */
app.use(
  cors({
    origin: [
      "https://yozgo-frontend.onrender.com",
      "http://localhost:5000",
      "http://localhost:5173",
      "https://yozgo.uz",
      "https://www.yozgo.uz",
    ],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: false }));

// ============ LOGGING UTILITY ============

/**
 * Standart formatdagi log yozish funksiyasi.
 * 
 * @param message - Xabar matni
 * @param source - Manba (default: express)
 */
export function log(message: string, source = "express"): void {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * API So'rovlarni kuzatish (Request Logger)
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  const requestPath = req.path;
  let capturedBody: any = undefined;

  const originalJson = res.json;
  res.json = function (body, ...args) {
    capturedBody = body;
    return originalJson.apply(res, [body, ...args]);
  };

  res.on("finish", () => {
    const elapsed = Date.now() - startAt;
    if (requestPath.startsWith("/api")) {
      const logMessage = `${req.method} ${requestPath} ${res.statusCode} in ${elapsed}ms`;
      log(capturedBody ? `${logMessage} :: ${JSON.stringify(capturedBody)}` : logMessage);
    }
  });

  next();
});

// ============ FINAL STARTUP ============
const isTestEnvironment = process.env.NODE_ENV === "test";

if (!isTestEnvironment) {
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [SYSTEM] SERVER BOUND TO PORT: ${PORT}`);
    console.log(`🚀 [SYSTEM] STATUS: ONLINE (MODE: ${process.env.NODE_ENV?.toUpperCase() || 'DEVELOPMENT'})`);
    log(`[SUCCESS] Port ${PORT} is open and ready for Render health checks.`);
  });
}

(async () => {
  // Test muhitida migratsiyalar va botlarni bloklash


  if (!isTestEnvironment) {
    try {
      log("Initializing database schema and migrations...", "startup");

      // Bir marta ishlaydigan DB tozalash logikasi (idempotent)
      await pool.query(`CREATE TABLE IF NOT EXISTS _one_time_reset (done boolean);`);
      const resetCheck = await pool.query(`SELECT * FROM _one_time_reset;`);

      if (resetCheck.rowCount === 0) {
        log("Performing one-time database initial reset...", "migration");
        await pool.query(`TRUNCATE TABLE users CASCADE;`);
        await pool.query(`INSERT INTO _one_time_reset (done) VALUES (true);`);
      }

      // Rollout migrations: foydalanuvchi rollari va telegram integratsiyasi
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'user';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id varchar UNIQUE;
      `);

      // Adminlarni tayinlash
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@yozgo.uz';
      await pool.query(`UPDATE users SET role = 'admin' WHERE email = $1;`, [adminEmail]);

      log("Database migrations successfully synchronized.", "startup");
    } catch (startupError) {
      console.warn("[WARNING] Startup DB synchronization skipped or failed:", startupError);
    }

    // Botlarni ishga tushirish (Main & User bots)
    try {
      const { startBot } = require("./bot");
      const { startUserBot } = require("./userBot");
      startBot();
      startUserBot();
      log("Integrations (Telegram Bots) are active.", "startup");
    } catch (botError) {
      console.error("[CRITICAL] Failed to start one or more bot services:", botError);
    }
  }

  // Swagger Documentation
  setupSwagger(app);

  // API Yo'nalishlarini ro'yxatdan o'tkazish
  await registerRoutes(httpServer, app);
  app.use("/api", debugRouter);

  // ============ ERROR HANDLING ============

  /**
   * Global xatoliklarni ushlab qolish middleware.
   * Server xatolarini foydalanuvchiga chiroyli ko'rinishda qaytaradi.
   */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[SERVER ERROR]:", err.stack || err);
    res.status(500).json({ 
      message: "Ichki server xatosi yuz berdi.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined 
    });
  });

  // ============ CLIENT SERVING ============

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    log("Setting up development environment with Vite...", "startup");
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Port already bound at top
})();

export { app, httpServer };

const shutdown = async (signal: string) => {
  log(`[SYSTEM] Qabul qilindi ${signal}. Tizim xavfsiz o'chirilmoqda...`, "shutdown");
  
  // 1. Yangi ulanishlarni qabul qilishni to'xtatish
  httpServer.close(() => {
    log("[SYSTEM] HTTP Server yopildi.", "shutdown");
  });

  try {
    // 2. Ma'lumotlar bazasi bilan ulanishni xavfsiz uzish
    const { pool } = require("./db");
    await pool.end();
    log("[SYSTEM] Database ulanishi uzildi.", "shutdown");
    
    // 3. Jarayonni xatosiz to'xtatish
    process.exit(0);
  } catch (error) {
    console.error("[CRITICAL] Tizimni o'chirishda xatolik:", error);
    process.exit(1);
  }
};

// Operatsion tizim signallarini eshitish
process.on("SIGINT", () => shutdown("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => shutdown("SIGTERM")); // Render/Docker stop
