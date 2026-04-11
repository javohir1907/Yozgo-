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
import compression from "compression";

import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { pool } from "./db";
import { setupSwagger } from "./swagger";
import debugRouter from "./debug-auth";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { sendAdminNotification } from "./utils/notifier";
import { startUserBot } from "./userBot";

// Sentry'ni ishga tushirish (DSN .env dan olinadi, agar yo'q bo'lsa Sentry o'chirilgan holatda turadi)
// Vaqtincha Sentry ni o'chirib qo'yamiz, sababi u Telegram tokenlaridagi ":" belgisi 
// bilan 'path-to-regexp' kutubxonasida konflikt qilib, barcha Telegram API larni (shu jumladan userBotni) bloklamoqda.
/*
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 1.0, // Hamma so'rovlarni kuzatish
    profilesSampleRate: 1.0,
  });
  logger.info("🛡️ [SYSTEM] Sentry Monitoring is ACTIVE.");
}
*/

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
app.use(compression());
const httpServer: Server = createServer(app);
const PORT = parseInt(process.env.PORT || "5000", 10);

// ============ PROCESS HANDLERS ============
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error("[CRITICAL] Unhandled Rejection at:", { promise, reason });
});

process.on("uncaughtException", (error: Error) => {
  logger.error("[CRITICAL] Uncaught Exception:", error);
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
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ limit: '10mb', extended: false }));

// ============ LOGGING UTILITY ============

// log() funksiyasi o'chirildi va winston logger'ga almashtirildi.

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
      if (capturedBody) {
        logger.info(`${logMessage} :: ${JSON.stringify(capturedBody)}`);
      } else {
        logger.info(logMessage);
      }
    }
  });

  next();
});

// ============ FINAL STARTUP ============
const isTestEnvironment = process.env.NODE_ENV === "test";

if (!isTestEnvironment) {
  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 [SYSTEM] SERVER BOUND TO PORT: ${PORT}`);
    logger.info(`🚀 [SYSTEM] STATUS: ONLINE (MODE: ${process.env.NODE_ENV?.toUpperCase() || 'DEVELOPMENT'})`);
    logger.info(`[SUCCESS] Port ${PORT} is open and ready for Render health checks.`);
  });
}

(async () => {
  // Test muhitida migratsiyalar va botlarni bloklash


  if (!isTestEnvironment) {
    try {
      logger.info("Initializing database schema and migrations...", { source: "startup" });

      // 1. Foydalanuvchilar jadvalini tozalash (Xavfsiz: faqat yangi _clear_users_v2 o'rnatilganda bir marta ishlaydi)
      await pool.query(`CREATE TABLE IF NOT EXISTS _clear_users_v2 (done boolean);`);
      const isCleared = await pool.query(`SELECT * FROM _clear_users_v2;`);
      
      if (isCleared.rowCount === 0) {
        logger.info("🗑️ Jadval tozalanmoqda: users (User request)...");
        await pool.query(`TRUNCATE TABLE users CASCADE;`);
        await pool.query(`INSERT INTO _clear_users_v2 (done) VALUES (true);`);
      }

      // 2. Majburiy ustunlarni qo'shish (Migration)
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'user';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id varchar UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS gender varchar;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nickname_change_at timestamp;
      `);

      // 4. Barcha mavjud rasmlarni o'chirish (User so'roviga binoan)
      const imageClearCheck = await pool.query(`CREATE TABLE IF NOT EXISTS _clear_images_v1 (done boolean);`);
      const isImagesCleared = await pool.query(`SELECT * FROM _clear_images_v1;`);
      if (isImagesCleared.rowCount === 0) {
        logger.info("🛡️ Mavjud profil rasmlari o'chirilmoqda...");
        await pool.query(`UPDATE users SET profile_image_url = NULL;`);
        await pool.query(`INSERT INTO _clear_images_v1 (done) VALUES (true);`);
      }


      // 3. Adminlarni tayinlash (User so'roviga binoan)
      await pool.query(`
        UPDATE users SET role = 'admin' 
        WHERE email IN ('xolmatovjavohir911@gmail.com', 'xolmatovjavohir812@gmail.com', 'admin@yozgo.uz')
      `);

      logger.info("✅ Database majburiy migratsiya va tozalash yakunlandi.", { source: "startup" });
    } catch (startupError) {
      logger.warn("[WARNING] Startup DB synchronization skipped or failed:", startupError);
    }

    // Botlarni ishga tushirish (Main & User bots)
    try {
      startUserBot();
      logger.info("Integrations (Telegram Bots) are active.", { source: "startup" });
    } catch (botError) {
      logger.error("[CRITICAL] Failed to start one or more bot services:", botError);
    }
  }

  // Swagger Documentation
  setupSwagger(app);

  // API Yo'nalishlarini ro'yxatdan o'tkazish
  await registerRoutes(httpServer, app);
  app.use("/api", debugRouter);

  // ============ ERROR HANDLING ============

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  /**
   * Global xatoliklarni ushlab qolish middleware.
   * Server xatolarini foydalanuvchiga chiroyli ko'rinishda qaytaradi.
   */
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error("[SERVER ERROR]:", err);

    // Faqatgina kutilmagan server xatoliklarida (500) adminga yozamiz
    if (err.status !== 404 && err.status !== 401) {
      const errorMessage = err.message || "Noma'lum xatolik";
      const errorStack = err.stack ? err.stack.substring(0, 500) : "";
      
      // FIRE AND FORGET: Server javobini Telegram kutib o'tirmasligi kerak (Mantiqiy yechim!)
      sendAdminNotification(
        `❌ <b>TIZIMDA XATOLIK YUZ BERDI!</b>\n\n` +
        `📍 <b>Manzil:</b> ${req.method} ${req.originalUrl}\n` +
        `⚠️ <b>Xato:</b> ${errorMessage}\n` +
        `<pre>${errorStack}</pre>`
      ).catch(e => logger.error("Fatal error notification failed:", e));
    }

    res.status(500).json({ 
      message: "Ichki server xatosi yuz berdi.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined 
    });
  });

  // ============ CLIENT SERVING ============

  log(`[SYSTEM] Frontend va Backend muvaffaqiyatli bog'landi va Server ishga tushirildi!`);
  
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    logger.info("Setting up development environment with Vite...", { source: "startup" });
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Port already bound at top
})();

export { app, httpServer };

const shutdown = async (signal: string) => {
  logger.info(`[SYSTEM] Qabul qilindi ${signal}. Tizim xavfsiz o'chirilmoqda...`, { source: "shutdown" });
  
  // 1. Yangi ulanishlarni qabul qilishni to'xtatish
  httpServer.close(() => {
    logger.info("[SYSTEM] HTTP Server yopildi.", { source: "shutdown" });
  });

  try {
    // 2. Ma'lumotlar bazasi bilan ulanishni xavfsiz uzish
    const { pool } = require("./db");
    await pool.end();
    logger.info("[SYSTEM] Database ulanishi uzildi.", { source: "shutdown" });
    
    // 3. Jarayonni xatosiz to'xtatish
    process.exit(0);
  } catch (error) {
    logger.error("[CRITICAL] Tizimni o'chirishda xatolik:", error);
    process.exit(1);
  }
};

// Operatsion tizim signallarini eshitish
process.on("SIGINT", () => shutdown("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => shutdown("SIGTERM")); // Render/Docker stop
