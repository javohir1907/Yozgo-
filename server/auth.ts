/**
 * YOZGO - Authentication & Session Management
 * 
 * Ushbu modul foydalanuvchilarni ro'yxatdan o'tkazish, login, session
 * boshqaruvi va Telegram mini-app avtorizatsiyasini ta'minlaydi.
 * 
 * @author YOZGO Team
 * @version 1.1.0
 */

// ============ IMPORTS ============
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import passport from "passport";
import type { Express, Request, Response, NextFunction } from "express";
import { eq, ilike } from "drizzle-orm";
import crypto from "crypto";

import { db, pool } from "./db";
import { users } from "@shared/models/auth";
// (bot import removed)
import { sendEmail } from "./mailer";
import { sendAdminNotification } from "./utils/notifier";

// ============ CONSTANTS ============
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 kun
const MIN_PASSWORD_LENGTH = 8;
const NICKNAME_REGEX = /^[a-z0-9_]{4,20}$/;

// ============ TYPES ============
interface SessionRequest extends Request {
  session: any;
}

// ============ AUTHENTICATION SYSTEM ============

/**
 * Passport.js va Express Session tizimini sozlaydi.
 * 
 * @param app - Express ilovasi
 */
export function setupAuth(app: Express): void {
  if (!process.env.SESSION_SECRET) {
    throw new Error("XAVF: SESSION_SECRET muhit o'zgaruvchisi o'rnatilmagan! Server xavfsizlik maqsadida to'xtatildi.");
  }

  // Proxy orqasida (Render/Nginx) ishonchni sozlash
  app.set("trust proxy", 1);

  // Sessionlarni PostgreSQL-da saqlash
  const PostgresStore = connectPg(session);
  const sessionStore = new PostgresStore({
    pool,
    createTableIfMissing: true,
    ttl: SESSION_EXPIRY / 1000,
    tableName: "sessions",
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: SESSION_EXPIRY,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // ============ REGISTER & LOGIN ROUTES ============

  /**
   * @openapi
   * /api/auth/register:
   *   post:
   *     tags: [Auth]
   *     summary: Yangi foydalanuvchini ro'yxatdan o'tkazish
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // 1. Asosiy validatsiya
      if (!email || !password) {
        return res.status(400).json({ message: "Email va parol majburiy" });
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak` });
      }

      if (!/(?=.*[A-Za-z])(?=.*\\d)/.test(password)) {
        return res.status(400).json({ message: "Parol kamida bitta harf va bitta raqamdan iborat bo'lishi kerak" });
      }

      // 2. Email bandligini tekshirish
      const [existingUserByEmail] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (existingUserByEmail) {
        return res.status(409).json({ message: "Ushbu email allaqachon ro'yxatdan o'tgan" });
      }

      // 3. Nickname (firstName) validatsiyasi
      if (!firstName || !NICKNAME_REGEX.test(firstName)) {
        return res.status(400).json({ 
          message: "Nickname faqat kichik harf, raqam va '_' dan iborat bo'lishi kerak (4-20 belgi)." 
        });
      }

      const [existingUserByNick] = await db.select().from(users).where(ilike(users.firstName, firstName.trim()));
      if (existingUserByNick) {
        return res.status(409).json({ message: "Ushbu nickname band, boshqasini tanlang" });
      }

      // 4. Parolni xavfsiz hetshlash va saqlash
      const hashedPassword = await bcrypt.hash(password, 10);
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName: firstName.trim(),
          lastName: lastName || null,
        })
        .returning();

      // Sessionga biriktirish
      (req.session as any).userId = newUser.id;

      // Telegram ogohlantirish (Async)
      sendAdminNotification(
        `🔔 <b>YANGI FOYDALANUVCHI!</b>\n\n` +
        `👤 <b>Foydalanuvchi:</b> ${firstName.trim() || 'Noma\'lum'}\n` +
        `📧 <b>Email:</b> ${email || 'Kiritilmagan'}\n` +
        `🆔 <b>ID:</b> ${newUser.id}\n\n` +
        `<i>Loyiha o'sib bormoqda! 🚀</i>`
      ).catch(console.error);

      const { password: _, ...userNoHash } = newUser;
      res.status(201).json(userNoHash);
    } catch (error) {
      console.error("[AUTH] Registration error:", error);
      res.status(500).json({ message: "Ro'yxatdan o'tishda xatolik yuz berdi" });
    }
  });

  /**
   * @openapi
   * /api/auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Tizimga kirish
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email va parol kiritilmadi" });
      }

      const [userMatch] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!userMatch) {
        return res.status(401).json({ message: "Email yoki parol xato" });
      }

      const isPasswordValid = await bcrypt.compare(password, userMatch.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Email yoki parol xato" });
      }

      // Session saqlash
      (req.session as any).userId = userMatch.id;
      
      const { password: _, ...safeProfile } = userMatch;
      res.status(200).json(safeProfile);
    } catch (error) {
      console.error("[AUTH] Login error:", error);
      res.status(500).json({ message: "Tizimga kirishda xatolik" });
    }
  });

  // ============ TELEGRAM INTEGRATION ============

  /**
   * Telegram Mini-app orqali avtorizatsiyani tekshirish va kirish.
   */
  app.post("/api/auth/telegram", async (req: Request, res: Response) => {
    try {
      const { initData } = req.body;
      if (!initData) return res.status(400).json({ message: "Telegram ma'lumotlari kiritilmadi" });

      const urlParams = new URLSearchParams(initData);
      const hashField = urlParams.get("hash");
      urlParams.delete("hash");

      const checkString = Array.from(urlParams.keys()).sort().map((k) => `${k}=${urlParams.get(k)}`).join("\n");
      const secretKey = crypto.createHmac("sha256", "WebAppData").update(process.env.TELEGRAM_BOT_TOKEN || "").digest();
      const calculatedHmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

      if (calculatedHmac !== hashField) {
        return res.status(401).json({ message: "Telegram validatsiyasi xato" });
      }

      // Replay attack prevention: auth_date tekshiruvi (5 daqiqa ruxsat)
      const authDate = Number(urlParams.get("auth_date"));
      const now = Math.floor(Date.now() / 1000);
      if (!authDate || now - authDate > 300) {
        return res.status(401).json({ message: "Telegram sessiyasi muddati tugagan (Replay Attack)" });
      }

      const tgUserRaw = JSON.parse(urlParams.get("user") || "{}");
      
      // Bazadan telegram_id orqali izlash
      let [linkedUser] = await db.select().from(users).where(eq(users.telegramId, String(tgUserRaw.id)));

      // Agar topilmasa, yangi 'shadow' profil ochish
      if (!linkedUser) {
        const dummyPassword = crypto.randomBytes(16).toString("hex");
        const [identity] = await db.insert(users).values({
          email: `tg_${tgUserRaw.id}@telegram.mini`,
          password: await bcrypt.hash(dummyPassword, 10),
          firstName: tgUserRaw.first_name,
          lastName: tgUserRaw.last_name || null,
          telegramId: String(tgUserRaw.id),
          profileImageUrl: tgUserRaw.photo_url || null,
        }).returning();
        linkedUser = identity;
      }

      (req.session as any).userId = linkedUser.id;
      const { password: _, ...authResponse } = linkedUser;
      res.status(200).json(authResponse);
    } catch (error) {
      console.error("[AUTH] Telegram auth error:", error);
      res.status(500).json({ message: "Telegram orqali kirishda xatolik" });
    }
  });

  // ============ GOOGLE OAUTH INTEGRATION ============

  app.get("/api/auth/google", (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: "Google Client ID o'rnatilmagan" });
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
    const scope = "email profile";
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    res.redirect(googleAuthUrl);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code) return res.redirect("/auth?error=NoCode");

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

      // Token olish
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId || "",
          client_secret: clientSecret || "",
          code: String(code),
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) return res.redirect("/auth?error=GoogleAuthFailed");

      // Foydalanuvchi profile ni olish
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profileData = await profileRes.json();

      let [existingUser] = await db.select().from(users).where(eq(users.email, profileData.email.toLowerCase()));

      if (!existingUser) {
        const dummyPassword = crypto.randomBytes(16).toString("hex");
        const [newUser] = await db.insert(users).values({
          email: profileData.email.toLowerCase(),
          password: await bcrypt.hash(dummyPassword, 10),
          firstName: (profileData.given_name || profileData.name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "") + "_" + crypto.randomBytes(2).toString("hex"),
          lastName: profileData.family_name || null,
          profileImageUrl: profileData.picture || null,
        }).returning();
        existingUser = newUser;
        
        sendAdminNotification(`🔔 <b>Google orqali yangi hisob:</b> ${existingUser.email}`).catch(() => {});
      }

      (req.session as any).userId = existingUser.id;
      res.redirect("/");
    } catch (error) {
      console.error("[AUTH] Google Callback Error:", error);
      res.redirect("/auth?error=ServerError");
    }
  });

  // ============ PASSWORD RESET ============

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email talab qilinadi" });

      const [userMatch] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!userMatch) {
         // Security: Xavfsizlik uchun email topilmasa ham 200 qaytaramiz (Enumeration attack ni oldini olish)
         return res.json({ message: "Email ga ko'rsatma yuborildi" });
      }

      // Xavfsiz JWT-o'rniga HMAC token yaratamiz (muddati 15 daqiqa)
      const expiry = Date.now() + 15 * 60 * 1000;
      const payload = `${userMatch.id}:${expiry}`;
      const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET + userMatch.password).update(payload).digest("hex");
      const resetToken = encodeURIComponent(`${payload}:${signature}`);
      
      const resetLink = `https://${req.get("host")}/reset-password?token=${resetToken}`;
      
      await sendEmail(
        userMatch.email, 
        "YOZGO: Parolni tiklash", 
        `Sizning YOZGO hisobingiz uchun parolni tiklash so'raldi.\n\nQuyidagi ssilka orqali o'tib parolni yangilang (15 daqiqagacha amal qiladi):\n${resetLink}\n\nAgar bu siz bo'lmasangiz, bu xabarni inkor eting.`
      );

      res.json({ message: "Email ga ko'rsatma yuborildi" });
    } catch (error) {
      console.error("[AUTH] Forgot password xatosi:", error);
      res.status(500).json({ message: "Xatolik yuz berdi" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ message: "Token va yangi parol kiritilmadi" });

      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Parol kamida ${MIN_PASSWORD_LENGTH} ta belgi bo'lishi kerak` });
      }

      const decodedToken = decodeURIComponent(token);
      const parts = decodedToken.split(":");
      if (parts.length !== 3) return res.status(400).json({ message: "Noto'g'ri token" });
      
      const [userId, expiryStr, signature] = parts;
      const expiry = parseInt(expiryStr, 10);

      if (Date.now() > expiry) {
        return res.status(400).json({ message: "Token muddati tugagan" });
      }

      const [userMatch] = await db.select().from(users).where(eq(users.id, userId));
      if (!userMatch) return res.status(400).json({ message: "Foydalanuvchi topilmadi" });

      const expectedSignature = crypto.createHmac("sha256", process.env.SESSION_SECRET + userMatch.password).update(`${userId}:${expiryStr}`).digest("hex");
      if (signature !== expectedSignature) {
        return res.status(400).json({ message: "Token haqiqiy emas yoki bekor qilingan" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

      res.json({ message: "Parol muvaffaqiyatli o'zgartirildi" });
    } catch (error) {
      console.error("[AUTH] Reset password xatosi:", error);
      res.status(500).json({ message: "Xatolik yuz berdi" });
    }
  });

  // ============ UTILITY AUTH ROUTES ============

  /**
   * Joriy session egasini qaytarish.
   */
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    const activeUserId = (req.session as any).userId;
    if (!activeUserId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const [foundUser] = await db.select().from(users).where(eq(users.id, activeUserId));
      if (!foundUser) return res.status(401).json({ message: "Unauthorized" });

      const { password: _, ...userSummary } = foundUser;
      res.json(userSummary);
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  /**
   * Tizimdan chiqish (Sessionni o'chirish).
   */
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Chiqishda xatolik" });
      res.clearCookie("connect.sid");
      res.sendStatus(200);
    });
  });
}

// ============ EXPORTS & MIDDLEWARE ============

/**
 * Avtorizatsiya qilinganligini tekshiruvchi middleware.
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if ((req.session as any).userId) {
    return next();
  }
  res.status(401).json({ message: "Iltimos, avval tizimga kiring" });
}
