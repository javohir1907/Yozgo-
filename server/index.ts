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
import { pool, db } from "./db";
import { sql } from "drizzle-orm";
import { setupSwagger } from "./swagger";
import debugRouter from "./debug-auth";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";
import { sendAdminNotification } from "./utils/notifier";
import { startUserBot } from "./userBot";
import { startStreakReminderJob } from "./jobs/streak-reminder.job";
import { startWeeklyRolloverJob } from "./jobs/weekly-rollover.job";
import { seedBadges } from "./gamification/badge-service";
import { seedLeagues } from "./services/league.service";
import { seedCosmetics } from "./gamification/cosmetic-defs";

// Sentry — FAQAT SENTRY_DSN berilgan bo'lsa init qilinadi; bo'lmasa butunlay o'chiq
// (server graceful, qulamaydi). tracesSampleRate:0 — HTTP/route tracing O'CHIQ: bu
// Telegram bot token ichidagi ":" belgisi 'path-to-regexp' bilan konflikt qilishining
// oldini oladi (avval userBot'ni bloklagan sabab). Butun init try/catch bilan himoyalangan.
if (process.env.SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0,
    });
    logger.info("🛡️ [SYSTEM] Sentry error-reporting yoqildi (tracing o'chiq).");
  } catch (e) {
    logger.warn("[SENTRY] init o'tkazib yuborildi (graceful):", e as any);
  }
}

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

// Coolify/Traefik/Cloudflare orqasida BIRINCHI proksiga ishonish — `secure` cookie,
// req.protocol (https) va real IP (rate-limit) to'g'ri ishlashi uchun. (auth.ts ham
// o'rnatadi; bu yerda erta o'rnatilishi barcha middleware'lar ko'rishini kafolatlaydi.)
app.set("trust proxy", 1);

app.use(compression({ level: 9, threshold: 1024 }));
const httpServer: Server = createServer(app);
const PORT = parseInt(process.env.PORT || "5000", 10);

// Health endpoint (Coolify/UptimeRobot healthcheck) — rate-limit va og'ir middleware'lardan
// OLDIN, hamisha tez 200 qaytaradi (jarayon tirikligini bildiradi).
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// ============ MODE IZOLYATSIYASI (APP_MODE — env-based) ============
// Bir Docker image, ikki instans APP_MODE bilan ajratiladi (host header EMAS):
//   APP_MODE=admin -> FAQAT /admin + /api/admin/* + auth/health/infra ochiq, qolgani 404
//   APP_MODE=main  -> /admin va /api/admin/* butunlay 404 (typing ilova ishlaydi)
// XAVFSIZLIK: APP_MODE o'rnatilmagan yoki noto'g'ri bo'lsa -> default "main".
//   Noto'g'ri konfig HECH QACHON admin'ni ochib qo'ymasligi kerak.
// Coolify: bitta image'dan ikkita app — biriga APP_MODE=admin, ikkinchisiga APP_MODE=main
// (yoki umuman qo'ymaslik). Har biriga o'z domeni bog'lanadi.
const APP_MODE = (process.env.APP_MODE || "").toLowerCase() === "admin" ? "admin" : "main";
const isDevelopment = process.env.NODE_ENV === "development";

app.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path;

  // Healthcheck HAR DOIM ochiq (ikkala mode, prod'da ham) — Coolify healthcheck sinmasin.
  if (path === "/api/health" || path === "/health") return next();

  // Development: izolyatsiya QO'LLANMAYDI — lokal test uchun hammasi ochiq.
  // PROD'da (NODE_ENV=production) bypass BO'LMAYDI — APP_MODE qat'iy majburlanadi.
  if (isDevelopment) return next();

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  const isAdminApi = path.startsWith("/api/admin");

  if (APP_MODE === "admin") {
    // Admin instansi: root -> /admin; admin sahifa/API + SPA infra ochiq, qolgani 404.
    if (path === "/") return res.redirect(302, "/admin");
    // SPA/infra: admin sahifasi yuklanishi uchun zarur (statik assetlar, auth).
    // Bularsiz admin sahifa bo'sh ekran bo'lardi.
    const isInfra =
      path.startsWith("/api/auth") ||
      path.startsWith("/assets") ||
      path.startsWith("/@") ||        // Vite dev: /@vite, /@react-refresh, /@fs
      path.startsWith("/src") ||       // Vite dev manba
      path.startsWith("/node_modules") ||
      path.startsWith("/favicon") ||
      path === "/robots.txt" || path === "/manifest.json" ||
      /\.(js|mjs|css|svg|png|jpg|jpeg|ico|webp|woff2?|ttf|json|map)$/.test(path);
    if (isAdminPage || isAdminApi || isInfra) return next();
    return res.status(404).json({ message: "Not found" });
  }

  // APP_MODE=main (default): admin YASHIRIN — /admin va /api/admin/* 404.
  if (isAdminPage || isAdminApi) {
    return res.status(404).json({ message: "Not found" });
  }
  return next();
});

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
// XAVFSIZLIK/DEV: Qat'iy CSP FAQAT production'da qo'llanadi. Development'da Vite
// inline <script> (React "preamble" + HMR mijozi) qo'shadi; script-src'da sha256
// hash borligi sababli 'unsafe-inline' e'tiborsiz qoladi (CSP spetsifikatsiyasi),
// natijada inline preamble bloklanadi -> "@vitejs/plugin-react can't detect
// preamble" xatosi va OQ EKRAN. Shuning uchun dev'da CSP butunlay o'chiriladi;
// production CSP o'zgarishsiz qat'iy holicha qoladi.
const isProductionEnv = process.env.NODE_ENV === "production";

app.use(
  helmet({
    contentSecurityPolicy: isProductionEnv ? {
      directives: {
        defaultSrc: ["'self'", "https://yozgo.uz", "https://www.yozgo.uz", "https://*.onrender.com"],
        // XAVFSIZLIK (M2): 'unsafe-eval' va 'unsafe-inline' OLIB TASHLANDI (XSS himoyasi).
        // Ilova skripti tashqi ('self') modul; yagona inline blok — index.html'dagi
        // JSON-LD (SEO, ijro etilmaydigan data) — uni sha256 hash bilan ruxsat berdik.
        // Hash statik (client/index.html bilan mos) — JSON-LD o'zgarsa qayta hisoblang.
        scriptSrc: [
          "'self'",
          "'sha256-rocP6WQ/X2Mh36w13yTIMoY1xtx72YZ2f//23z44QvI='",
          "https://yozgo.uz", "https://www.yozgo.uz",
          "https://www.googletagmanager.com", "https://www.google-analytics.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://yozgo.uz", "https://www.yozgo.uz", "https://fonts.googleapis.com"],
        // XAVFSIZLIK (M2): "*" va keng "https:" olib tashlandi — faqat kerakli domenlar.
        // Rasmlar amalda: self (favicon/bundlar), data:/blob:, yozgo.uz (og-image).
        // lh3.googleusercontent.com — legacy Google avatar uchun ehtiyot chorasi.
        imgSrc: [
          "'self'", "data:", "blob:",
          "https://yozgo.uz", "https://www.yozgo.uz",
          "https://lh3.googleusercontent.com",
        ],
        connectSrc: ["'self'", "wss:", "ws:", "https:", "http:", "https://yozgo.uz", "https://www.yozgo.uz"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        frameAncestors: ["'none'"],
      },
    } : false,
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

  res.on("finish", () => {
    const elapsed = Date.now() - startAt;
    if (requestPath.startsWith("/api")) {
      // XAVFSIZLIK: Javob tanasi (response body) LOG QILINMAYDI. Aks holda
      // login/register qaytaradigan `token: req.sessionID`, parol hashlari va
      // foydalanuvchi PII'si log fayllarga tushib, session o'g'irlanishiga olib keladi.
      logger.info(`${req.method} ${requestPath} ${res.statusCode} in ${elapsed}ms`);
    }
  });

  next();
});

// ============ FINAL STARTUP ============
const isTestEnvironment = process.env.NODE_ENV === "test";

// Port will be bound at the end of the initialization flow below.

(async () => {
  // Test muhitida migratsiyalar va botlarni bloklash


  if (!isTestEnvironment) {
    try {
      logger.info("Initializing database schema and migrations...", { source: "startup" });

      // XAVFSIZLIK: Ilgari bu yerda `TRUNCATE TABLE users CASCADE` (`_clear_users_v2`
      // bayrog'i bilan) turardi. Production startup'da bunday buzg'unchi bir-martalik
      // tozalash bo'lmasligi kerak — bayroq jadvali o'chsa yoki yangi DB'da barcha
      // foydalanuvchilar yo'qolardi. Butunlay olib tashlandi.

      // 2. Majburiy ustunlarni qo'shish (Migration)
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'user';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id varchar UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS gender varchar;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_nickname_change_at timestamp;
        -- Gamifikatsiya Feature 1: XP & Level (additive, mavjud rowlar 0/1'ga backfill).
        ALTER TABLE users ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;
        -- Gamifikatsiya Feature 2: Kunlik streak (additive).
        ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date date;
        -- Gamifikatsiya Feature 8: Coin + kosmetika (additive).
        ALTER TABLE users ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freezes integer NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_theme_key varchar;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_frame_key varchar;
      `);

      // XAVFSIZLIK: Ilgari bu yerda profil rasmlarini bir marta NULL qiladigan
      // `_clear_images_v1` bloki turardi — TRUNCATE kabi buzg'unchi bir-martalik
      // startup tozalash. Bayroq jadvali o'chsa yoki yangi DB'da barcha profil
      // rasmlari yo'qolardi. Butunlay olib tashlandi.

      // 3. Adminlarni tayinlash (ADMIN_EMAILS env var'idan, vergul bilan ajratilgan)
      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (adminEmails.length > 0) {
        await pool.query(
          `UPDATE users SET role = 'admin' WHERE lower(email) = ANY($1::text[])`,
          [adminEmails],
        );
      }

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

    // Scheduled jobs (node-cron) — FAQAT production'da va RUN_CRON=true bo'lgan BITTA
    // instance'da. Multi-instance Render deploy'da har instance cron'ni ishga tushirsa
    // dublikat Telegram xabar bo'ladi; RUN_CRON'ni bitta instance'ga qo'ying.
    if (process.env.NODE_ENV === "production" && process.env.RUN_CRON === "true") {
      try {
        startStreakReminderJob();
        startWeeklyRolloverJob();
        logger.info("Scheduled jobs (cron) are active.", { source: "startup" });
      } catch (cronError) {
        logger.error("[CRITICAL] Failed to start scheduled jobs:", cronError);
      }
    }
  }

  // Swagger Documentation
  setupSwagger(app);

  // API Yo'nalishlarini ro'yxatdan o'tkazish
  await registerRoutes(httpServer, app);

  // XAVFSIZLIK: /api/debug-info session, cookie va env holatini oshkor qiladi.
  // Faqat production BO'LMAGAN muhitda ro'yxatga olinadi.
  if (process.env.NODE_ENV !== "production") {
    app.use("/api", debugRouter);
  }

  // ============ ERROR HANDLING ============

  if (process.env.SENTRY_DSN) {
    try {
      Sentry.setupExpressErrorHandler(app);
    } catch (e) {
      logger.warn("[SENTRY] express error handler o'tkazib yuborildi:", e as any);
    }
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

  logger.info(`[SYSTEM] Frontend va Backend muvaffaqiyatli bog'landi va Server ishga tushirildi!`);
  
  // Majburiy Bazani Yangilash Skripti (drizzle-kit push Renderda xato bergan holatlar uchun)
  try {
    logger.info(`[DB] Bazani tekshirish va yangilash (Auto-Migration) boshlandi...`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 10;`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS gender_restriction TEXT DEFAULT 'all';`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS room_price INTEGER DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS access_code TEXT;`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60;`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS competition_length INTEGER DEFAULT 10;`);
    await db.execute(sql`ALTER TABLE battles ADD COLUMN IF NOT EXISTS creator_role TEXT DEFAULT 'participant';`);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS competition_creation_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR NOT NULL UNIQUE,
        max_participants INTEGER NOT NULL,
        is_used BOOLEAN DEFAULT false NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP,
        active_battle_id UUID REFERENCES battles(id),
        used_by_user_id VARCHAR REFERENCES users(id)
      );
    `);
    
    // Yagonga xona kodi (room_user) limitini olib tashlaymiz (individual kodlarni ko'paytirish uchun)
    await db.execute(sql`ALTER TABLE room_access_codes DROP CONSTRAINT IF EXISTS room_user_unique;`);

    // Gamifikatsiya Feature 1: per-natija XP audit ustunlari (additive).
    await db.execute(sql`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS xp_awarded integer NOT NULL DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE battle_participants ADD COLUMN IF NOT EXISTS xp_awarded integer NOT NULL DEFAULT 0;`);
    // Feature 8: coin audit ustunlari (additive).
    await db.execute(sql`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS coins_awarded integer NOT NULL DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE battle_participants ADD COLUMN IF NOT EXISTS coins_awarded integer NOT NULL DEFAULT 0;`);

    // Request-idempotency: client_result_id + (user_id, client_result_id) unikal (additive).
    await db.execute(sql`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS client_result_id uuid;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS test_results_user_client_uniq ON test_results (user_id, client_result_id);`);
    // RISK-B tuzatish (additive, idempotent): client_result_id endi MAJBURIY. NULL bo'lsa
    // (user_id, NULL) Postgres'da distinct edi -> double-submit idempotencyni chetlab o'tardi.
    // Eski NULL rowlarni (legacy/battle mirror) unik uuid bilan to'ldiramiz, so'ng
    // DEFAULT gen_random_uuid() + NOT NULL. Solo submit uuidsiz kelsa API 400 qaytaradi.
    await db.execute(sql`UPDATE test_results SET client_result_id = gen_random_uuid() WHERE client_result_id IS NULL;`);
    await db.execute(sql`ALTER TABLE test_results ALTER COLUMN client_result_id SET DEFAULT gen_random_uuid();`);
    await db.execute(sql`ALTER TABLE test_results ALTER COLUMN client_result_id SET NOT NULL;`);

    // Gamifikatsiya Feature 3: Badge katalogi + user_badges (additive, idempotent).
    // UNIQUE(user_id,badge_id) alohida CREATE UNIQUE INDEX sifatida — mavjud jadvalda
    // ham ON CONFLICT ishlashi uchun (Contract: migration qat'iyligi).
    await db.execute(sql`CREATE TABLE IF NOT EXISTS badges ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT NOT NULL UNIQUE, icon TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0 );`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS user_badges ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR NOT NULL REFERENCES users(id), badge_id UUID NOT NULL REFERENCES badges(id), earned_at TIMESTAMP NOT NULL DEFAULT now() );`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_badge_unique ON user_badges (user_id, badge_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS user_badges_user_idx ON user_badges (user_id);`);
    await seedBadges();

    // Gamifikatsiya Feature 5: Ligalar (additive, idempotent). UNIQUE(user_id) alohida
    // CREATE UNIQUE INDEX sifatida — ON CONFLICT (user_id) mavjud jadvalda ham ishlashi uchun.
    await db.execute(sql`CREATE TABLE IF NOT EXISTS leagues ( id SERIAL PRIMARY KEY, key TEXT NOT NULL UNIQUE, tier INTEGER NOT NULL UNIQUE, name TEXT NOT NULL, icon TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0 );`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS league_members ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR NOT NULL REFERENCES users(id), league_tier INTEGER NOT NULL DEFAULT 0, cohort_id UUID, weekly_xp INTEGER NOT NULL DEFAULT 0, week_start DATE, joined_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now() );`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS league_members_user_uniq ON league_members (user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS league_members_cohort_idx ON league_members (cohort_id, weekly_xp);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS league_members_tier_idx ON league_members (league_tier);`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS league_history ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR NOT NULL REFERENCES users(id), week_start DATE NOT NULL, league_tier INTEGER NOT NULL, final_rank INTEGER NOT NULL, weekly_xp INTEGER NOT NULL, outcome TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT now() );`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS league_history_user_idx ON league_history (user_id, week_start);`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS league_reset_log ( week_start DATE PRIMARY KEY, run_at TIMESTAMP NOT NULL DEFAULT now() );`);
    await seedLeagues();

    // Gamifikatsiya Feature 6: Kunlik quest progressi (additive, idempotent).
    await db.execute(sql`CREATE TABLE IF NOT EXISTS daily_quest_progress ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR NOT NULL REFERENCES users(id), quest_key TEXT NOT NULL, quest_date DATE NOT NULL, progress INTEGER NOT NULL DEFAULT 0, target INTEGER NOT NULL, completed BOOLEAN NOT NULL DEFAULT false, completed_at TIMESTAMP, xp_awarded INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT now() );`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS daily_quest_user_key_date ON daily_quest_progress (user_id, quest_key, quest_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS daily_quest_user_date_idx ON daily_quest_progress (user_id, quest_date);`);

    // Gamifikatsiya Feature 8: Kosmetika katalogi + egalik (additive, idempotent).
    await db.execute(sql`CREATE TABLE IF NOT EXISTS cosmetics ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT NOT NULL UNIQUE, type TEXT NOT NULL, price INTEGER NOT NULL, meta JSONB NOT NULL DEFAULT '{}', sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true );`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS user_cosmetics ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id VARCHAR NOT NULL REFERENCES users(id), cosmetic_id UUID NOT NULL REFERENCES cosmetics(id), acquired_at TIMESTAMP NOT NULL DEFAULT now() );`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS user_cosmetic_unique ON user_cosmetics (user_id, cosmetic_id);`);
    await seedCosmetics();

    // Gamifikatsiya Feature 9: Do'stlar (additive, idempotent). LEAST/GREATEST unique
    // index alohida — teskari juftlik dublikatini bloklaydi (mavjud jadvalda ham).
    await db.execute(sql`CREATE TABLE IF NOT EXISTS friendships ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), requester_id VARCHAR NOT NULL REFERENCES users(id), addressee_id VARCHAR NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMP NOT NULL DEFAULT now() );`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_uniq ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS friendship_requester_idx ON friendships (requester_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS friendship_addressee_idx ON friendships (addressee_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS friendship_status_idx ON friendships (status);`);

    // Admin audit log (additive, idempotent) — ban/unban/grant/edit/broadcast amallari.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id VARCHAR REFERENCES users(id),
        action TEXT NOT NULL,
        target_user_id VARCHAR REFERENCES users(id),
        details JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log (created_at DESC);`);

    // Tasdiqlash kodlari (register/login — email + Telegram). In-memory Map o'rniga (additive).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel TEXT NOT NULL,
        identifier TEXT NOT NULL,
        code TEXT NOT NULL,
        token TEXT,
        telegram_id VARCHAR,
        phone VARCHAR,
        verified BOOLEAN NOT NULL DEFAULT false,
        purpose TEXT NOT NULL DEFAULT 'register',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
    // Oldingi boot yaratgan jadval uchun additive ustunlar (drizzle SELECT hamma
    // ustunni sanaydi — ustun yetishmasa barcha auth so'rovlari 42703 bilan yiqiladi).
    await db.execute(sql`ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS phone VARCHAR;`);
    await db.execute(sql`ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS verification_token_idx ON verification_codes (token);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS verification_chan_id_idx ON verification_codes (channel, identifier);`);

    logger.info(`[DB] Bazaga barcha yangi ustunlar muvaffaqiyatli qo'shildi / tekshirildi!`);
  } catch (err: any) {
    logger.info(`[DB ERROR] Bazani avtomatik yangilashda xato: ` + err.message);
  }

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    logger.info("Setting up development environment with Vite...", { source: "startup" });
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Port already bound at top
  if (!isTestEnvironment) {
    httpServer.listen(PORT, "0.0.0.0", () => {
      logger.info(`🚀 [SYSTEM] SERVER BOUND TO PORT: ${PORT}`);
      logger.info(`🚀 [SYSTEM] STATUS: ONLINE (MODE: ${process.env.NODE_ENV?.toUpperCase() || 'DEVELOPMENT'})`);
      logger.info(`[SUCCESS] Port ${PORT} is open and ready for Render health checks.`);
    });
  }
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
