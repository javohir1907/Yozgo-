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
import rateLimit from "express-rate-limit";

// ============ CONSTANTS ============
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 kun
const MIN_PASSWORD_LENGTH = 6;
const NICKNAME_REGEX = /^[a-z0-9_]{4,20}$/;

const otpStore = new Map<string, { code: string; expiresAt: number; data?: any }>();
const OTP_EXPIRY = 5 * 60 * 1000;

// ============ MEMORY CLEANUP ============
// Har 10 daqiqada eskirgan OTP kodlarni xotiradan tozalaymiz
setInterval(() => {
  const now = Date.now();
  for (const [email, otpData] of otpStore.entries()) {
    if (now > otpData.expiresAt) {
      otpStore.delete(email);
    }
  }
}, 10 * 60 * 1000);

// ============ TYPES ============
interface SessionRequest extends Request {
  session: any;
}

// ============ AUTHENTICATION SYSTEM ============

export let sessionMiddleware: any = null;

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

  sessionMiddleware = session({
      secret: process.env.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      proxy: true, // Render kabi proksilar uchun muhim
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Localda muammo qilmasligi uchun lax, serverda kross-domen uchratsa none
        maxAge: SESSION_EXPIRY,
      },
  });

  app.use(sessionMiddleware);

  app.use(passport.initialize());
  app.use(passport.session());

  const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 daqiqa
    max: 3, // Bitta IP dan 5 daqiqada faqat 3 marta OTP so'rash mumkin
    message: "Juda ko'p so'rov yuborildi. Iltimos keyinroq urinib ko'ring."
  });

  const authAttemptLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 daqiqa
    max: 10, // 15 daqiqada 10 marta urinish mumkin
    message: "Juda ko'p urinishlar qilindi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring."
  });

  const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 soat
    max: 3, // 1 soatda faqat 3 marta parol tiklash so'rovi yuborish mumkin
    message: "Juda ko'p so'rov yuborildi. Iltimos 1 soatdan keyin urinib ko'ring."
  });

  // ============ REGISTER & LOGIN ROUTES ============

  app.post("/api/auth/send-register-otp", otpLimiter, async (req: Request, res: Response) => {
    try {
      const { email, firstName } = req.body;
      if (!email || !firstName) return res.status(400).json({ message: "Email va Nickname kiritilmadi" });

      const emailStr = email.toLowerCase();
      const [existingUserByEmail] = await db.select().from(users).where(eq(users.email, emailStr));
      if (existingUserByEmail) return res.status(409).json({ message: "Ushbu email allaqachon ro'yxatdan o'tgan" });
      
      const [existingUserByNick] = await db.select().from(users).where(ilike(users.firstName, firstName.trim()));
      if (existingUserByNick) return res.status(409).json({ message: "Ushbu nickname band, boshqasini tanlang" });

      const otp = crypto.randomInt(100000, 999999).toString();
      otpStore.set(emailStr, { code: otp, expiresAt: Date.now() + OTP_EXPIRY });

      await sendEmail(
         emailStr,
         "YOZGO: Ro'yxatdan o'tish uchun kod",
         `Sizning YOZGO tasdiqlash kodingiz: ${otp}\nUshbu kod 5 daqiqa davomida amal qiladi.`
      );

      res.status(200).json({ message: "Kod yuborildi" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Xatolik" });
    }
  });

  /**
   * @openapi
   * /api/auth/register:
   *   post:
   *     tags: [Auth]
   *     summary: Yangi foydalanuvchini ro'yxatdan o'tkazish
   */
  app.post("/api/auth/register", authAttemptLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, otp, gender } = req.body;

      // 1. Asosiy validatsiya
      if (!email || !password || !gender) {
        return res.status(400).json({ message: "Email, parol va jins majburiy" });
      }

      if (gender !== "male" && gender !== "female") {
        return res.status(400).json({ message: "Jins noto'g'ri ko'rsatilgan (male yoki female bo'lishi shart)" });
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak` });
      }

      if (!otp) {
        return res.status(400).json({ message: "Tasdiqlash kodi talab qilinadi" });
      }
      const storedOtp = otpStore.get(email.toLowerCase());
      if (!storedOtp || storedOtp.code !== otp || Date.now() > storedOtp.expiresAt) {
        return res.status(400).json({ message: "Kod xato yoki muddati o'tgan" });
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
          gender: gender,
          role: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase()) ? 'admin' : 'user',
        })
        .returning();

      otpStore.delete(email.toLowerCase());

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
  app.post("/api/auth/login", authAttemptLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email va parol kiritilmadi" });
      }

      const safeEmail = email.trim().toLowerCase();
      const safePassword = password.trim();

      const [userMatch] = await db.select().from(users).where(eq(users.email, safeEmail));
      if (!userMatch) {
        return res.status(401).json({ message: "Email yoki parol xato" });
      }

      if (!userMatch.password) {
        return res.status(401).json({ message: "Bu elektron pochta orqali faqat Google yordamida kirish mumkin." });
      }

      const isPasswordValid = await bcrypt.compare(safePassword, userMatch.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Email yoki parol xato" });
      }

      // Session saqlash
      (req.session as any).userId = userMatch.id;
      
      const { password: _, ...safeProfile } = userMatch;
      res.status(200).json(safeProfile);
    } catch (error) {
      console.error("[AUTH] Login error:", error);
      res.status(500).json({ message: `Tizimga kirishda xatolik: ${String(error)}` });
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
          // profileImageUrl: tgUserRaw.photo_url || null, // O'chirildi
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
    const clientId = process.env.GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: "Google Client ID o'rnatilmagan" });
    const BACKEND_URL = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${BACKEND_URL}/api/auth/google/callback`;
    const scope = "email profile";
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
    res.redirect(googleAuthUrl);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code) return res.redirect("/auth?error=NoCode");

    try {
      const clientId = process.env.GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
      const BACKEND_URL = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
      const redirectUri = `${BACKEND_URL}/api/auth/google/callback`;

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

      let frontendUrl = process.env.NODE_ENV === "production" ? "https://yozgo.uz" : "http://localhost:5173";

      if (!profileData || !profileData.email) {
         return res.redirect(`${frontendUrl}/auth?error=EmailNotProvidedByGoogle`);
      }

      const emailStr = profileData.email.toLowerCase();

      let [existingUser] = await db.select().from(users).where(eq(users.email, emailStr));

      if (!existingUser) {
        const otp = crypto.randomInt(100000, 999999).toString();
        // save their google profile in otpStore
        otpStore.set("google:" + emailStr, {
          code: otp,
          expiresAt: Date.now() + OTP_EXPIRY,
          data: profileData
        });

        await sendEmail(
           profileData.email,
           "YOZGO: Google orqali kirish tasdiqlash kodi",
           `Sizning YOZGO tasdiqlash kodingiz: ${otp}\nUshbu kod 5 daqiqa davomida amal qiladi.`
        );

        return res.redirect(`${frontendUrl}/auth?googleOtpEmail=${encodeURIComponent(profileData.email.toLowerCase())}`);
      }

      (req.session as any).userId = existingUser.id;
      
      res.redirect(frontendUrl);
    } catch (error) {
      console.error("[AUTH] Google Callback Error:", error);
      const frontendUrl = process.env.NODE_ENV === "production" ? "https://yozgo.uz" : "http://localhost:5173";
      res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
  });

  app.post("/api/auth/google-verify", authAttemptLimiter, async (req: Request, res: Response) => {
    try {
      const { email, otp, gender } = req.body;
      if (!email || !otp || !gender) return res.status(400).json({ message: "Ma'lumotlar to'liq emas (jins majburiy)" });

      if (gender !== "male" && gender !== "female") {
        return res.status(400).json({ message: "Jins noto'g'ri (male yoki female bo'lishi shart)" });
      }

      const stored = otpStore.get("google:" + email.toLowerCase());
      if (!stored || stored.code !== otp || Date.now() > stored.expiresAt) {
           return res.status(400).json({ message: "Kod xato yoki muddati o'tgan" });
      }
      
      const profileData = stored.data;
      const dummyPassword = crypto.randomBytes(16).toString("hex");
      const [newUser] = await db.insert(users).values({
        email: profileData.email.toLowerCase(),
        password: await bcrypt.hash(dummyPassword, 10),
        firstName: (profileData.given_name || profileData.name || "user").toLowerCase().replace(/[^a-z0-9_]/g, "") + "_" + crypto.randomBytes(2).toString("hex"),
        lastName: profileData.family_name || null,
        gender: gender,
        // profileImageUrl: profileData.picture || null, // Rasm saqlash o'chirildi
        role: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).includes(profileData.email.toLowerCase()) ? 'admin' : 'user'
      }).returning();
      
      otpStore.delete("google:" + email.toLowerCase());

      sendAdminNotification(`🔔 <b>Google orqali yangi hisob:</b> ${newUser.email}`).catch(() => {});
      
      (req.session as any).userId = newUser.id;
      const { password: _, ...safeProfile } = newUser;
      res.status(200).json(safeProfile);
    } catch (error) {
      console.error("[AUTH] Google Verify Error:", error);
      res.status(500).json({ message: "Xatolik yuz berdi" });
    }
  });

  // ============ PASSWORD RESET ============

  app.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email talab qilinadi" });

      const [userMatch] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!userMatch) {
         // Security: Xavfsizlik uchun email topilmasa ham 200 qaytaramiz (Enumeration attack ni oldini olish)
         return res.json({ message: "Email ga ko'rsatma yuborildi" });
      }

      // Parolni darhol atmashtirmasdan, reset token yaratamiz
      const expiry = Date.now() + 15 * 60 * 1000; // 15 mins
      const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET + userMatch.password).update(`${userMatch.id}:${expiry}`).digest("hex");
      const resetToken = encodeURIComponent(`${userMatch.id}:${expiry}:${signature}`);
      
      const frontendUrl = process.env.NODE_ENV === "production" ? "https://yozgo.uz" : "http://localhost:5173";
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
      
      // Gmailga yuborish
      await sendEmail(
        userMatch.email, 
        "YOZGO: Parolni Tiklash", 
        `Sizning YOZGO hisobingiz uchun parolni tiklash so'rovi tushdi.\n\n📧 Login: ${userMatch.email}\n🔗 Tiklash uchun havola: ${resetLink}\n\nIltimos, ushbu havolani hech kimga bermang. Havola muddati 15 daqiqa.`
      );

      // Adminga xabar yuborish
      sendAdminNotification(
        `🔐 <b>Parol tiklash so'rovi:</b>\n` +
        `👤 User: ${userMatch.email}`
      ).catch(() => {});

      res.json({ message: "Yangi parol pochtangizga yuborildi" });
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

  app.post("/api/auth/update-password", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ message: "Avtorizatsiyadan o'tilmagan" });
      }

      const { newPassword } = req.body;
      if (!newPassword) {
        return res.status(400).json({ message: "Yangi parolni kiriting" });
      }

      const safeNewPassword = newPassword.trim();

      if (safeNewPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Yangi parol kamida ${MIN_PASSWORD_LENGTH} ta belgi bo'lishi kerak` });
      }

      const [userMatch] = await db.select().from(users).where(eq(users.id, userId));
      if (!userMatch) {
        return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      }

      const hashedNewPassword = await bcrypt.hash(safeNewPassword, 10);
      await db.update(users).set({ password: hashedNewPassword }).where(eq(users.id, userMatch.id));

      res.status(200).json({ message: "Parol muvaffaqiyatli o'zgartirildi" });
    } catch (error) {
      console.error("[AUTH] Update password error:", error);
      res.status(500).json({ message: "Parolni o'zgartirishda xatolik yuz berdi" });
    }
  });

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
   * Foydalanuvchi nicknamini o'zgartirish (har 90 kunda bir marta)
   */
  app.post("/api/auth/update-nickname", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      const { newNickname } = req.body;

      if (!newNickname || newNickname.length < 4 || newNickname.length > 20) {
        return res.status(400).json({ message: "Nickname 4 tadan 20 tagacha belgidan iborat bo'lishi kerak" });
      }

      const formattedNickname = newNickname.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (formattedNickname !== newNickname.trim()) {
        return res.status(400).json({ message: "Nickname faqat kichik harflar, raqamlar va pastki chiziqdan iborat bo'lishi mumkin" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });

      // 90 kunlik cheklovni tekshirish
      if (user.lastNicknameChangeAt) {
        const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
        const timePassed = Date.now() - new Date(user.lastNicknameChangeAt).getTime();
        if (timePassed < ninetyDaysInMs) {
          const daysLeft = Math.ceil((ninetyDaysInMs - timePassed) / (1000 * 60 * 60 * 24));
          return res.status(403).json({ message: `Nicknameni o'zgartirish uchun yana ${daysLeft} kun kutishingiz kerak` });
        }
      }

      // Nickname bandligini tekshirish
      const [existing] = await db.select().from(users).where(eq(users.firstName, formattedNickname));
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "Bu nickname allaqachon band, boshqasini tanlang" });
      }

      await db.update(users).set({ 
        firstName: formattedNickname,
        lastNicknameChangeAt: new Date()
      }).where(eq(users.id, userId));

      res.json({ message: "Nickname muvaffaqiyatli o'zgartirildi" });
    } catch (error) {
      console.error("[AUTH] Nickname update error:", error);
      res.status(500).json({ message: "Xatolik yuz berdi" });
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
