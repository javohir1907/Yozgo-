/**
 * YOZGO - Authentication & Session Management
 *
 * Ro'yxatdan o'tish (email + Telegram — IKKALASI alohida verify qilinishi majburiy)
 * va login (email/username + parol YOKI Telegram).
 * Tasdiqlash kodlari DB'da (verification_codes) — multi-instance/restart'ga chidamli.
 *
 * @author YOZGO Team
 * @version 2.0.0
 */

// ============ IMPORTS ============
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import type { Express, Request, Response, NextFunction } from "express";
import { eq, ilike, and, gt, lt, or } from "drizzle-orm";
import crypto from "crypto";

import { db, pool } from "./db";
import { users } from "@shared/models/auth";
import { verificationCodes } from "@shared/schema";
import { sendEmail } from "./mailer";
import { sendAdminNotification } from "./utils/notifier";
import rateLimit from "express-rate-limit";

// ============ CONSTANTS ============
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 kun
const MIN_PASSWORD_LENGTH = 6;
const NICKNAME_REGEX = /^[a-z0-9_]{4,20}$/;
const CODE_TTL_MS = 5 * 60 * 1000; // tasdiqlash kodi 5 daqiqa amal qiladi
// Kanal tasdiqlangach (verified=true) qatorga qo'shimcha umr — foydalanuvchi ikkinchi
// kanalni tasdiqlab final submit qilguncha cleanup interval qatorni o'chirib yubormasin.
const VERIFIED_TTL_MS = 30 * 60 * 1000;

// ============ HELPERS ============
function genCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// LIKE/ILIKE maxsus belgilarini ekranlash. '_' username'da RUXSAT ETILGAN belgi —
// ekranlanmasa istalgan bitta belgiga mos keladi ('ali_99' ILIKE 'alik99' rowiga ham
// tegadi), '%' esa istalgan foydalanuvchini tanlab beradi.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

// Telegram deep-link: user Start bosgach bot token orqali sessiyani bog'laydi.
function botDeepLink(token: string): string {
  const bot = process.env.BOT_USERNAME || "yozgo_bot";
  return `https://t.me/${bot}?start=auth_${token}`;
}

// Eskirgan tasdiqlash kodlarini muntazam tozalash (DB, in-memory Map EMAS).
setInterval(async () => {
  try {
    await db.delete(verificationCodes).where(lt(verificationCodes.expiresAt, new Date()));
  } catch { /* jimgina */ }
}, 10 * 60 * 1000);

// ============ AUTHENTICATION SYSTEM ============

export let sessionMiddleware: any = null;

/**
 * Passport.js va Express Session tizimini sozlaydi.
 */
export function setupAuth(app: Express): void {
  if (!process.env.SESSION_SECRET) {
    throw new Error("XAVF: SESSION_SECRET muhit o'zgaruvchisi o'rnatilmagan! Server xavfsizlik maqsadida to'xtatildi.");
  }

  app.set("trust proxy", 1);

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
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY,
      path: "/",
    },
  });

  app.use(sessionMiddleware);

  // SAFARI ITP FALLBACK: uchinchi-tomon cookie bloklansa, Authorization: Bearer <sid> orqali
  // sessiyani DB'dan qo'lda tiklaymiz.
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!(req.session as any)?.userId && req.headers.authorization?.startsWith("Bearer ")) {
      const sid = req.headers.authorization.split(" ")[1];
      if (sid && sid.length > 5) {
        try {
          const result = await pool.query("SELECT sess FROM sessions WHERE sid = $1", [sid]);
          if (result.rows.length > 0 && result.rows[0].sess?.userId) {
            (req.session as any).userId = result.rows[0].sess.userId;
          }
        } catch (e) {
          console.error("[AUTH FALLBACK] Session DB ruxsat xatosi:", e);
        }
      }
    }
    next();
  });

  const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: "Juda ko'p so'rov yuborildi. Iltimos keyinroq urinib ko'ring.",
  });

  const authAttemptLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Juda ko'p urinishlar qilindi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring.",
  });

  const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: "Juda ko'p so'rov yuborildi. Iltimos 1 soatdan keyin urinib ko'ring.",
  });

  // BITTA instance ikkala verify route'da — per-IP hisoblagich umumiy bo'lib
  // 6 xonali kodni brute-force qilishni cheklaydi (10 urinish / 5 daqiqa).
  const codeVerifyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: "Juda ko'p urinishlar. Iltimos keyinroq urinib ko'ring.",
  });

  // ============ USERNAME AVAILABILITY ============
  app.get("/api/auth/check-username", async (req: Request, res: Response) => {
    try {
      const raw = ((req.query.username as string) || "").trim();
      if (!raw || !NICKNAME_REGEX.test(raw)) {
        return res.status(200).json({ available: false });
      }
      const [existing] = await db.select({ id: users.id }).from(users).where(ilike(users.firstName, escapeLike(raw)));
      res.status(200).json({ available: !existing });
    } catch (e) {
      console.error("check-username error", e);
      res.status(500).json({ message: "Xatolik" });
    }
  });

  // ============ EMAIL kanal: register uchun OTP ============
  app.post("/api/auth/register/email-otp", otpLimiter, async (req: Request, res: Response) => {
    try {
      const { email, username } = req.body;
      if (!email || !username) return res.status(400).json({ message: "Email va username kiritilmadi" });

      const emailStr = String(email).toLowerCase().trim();
      const uname = String(username).trim().toLowerCase();
      if (!NICKNAME_REGEX.test(uname)) {
        return res.status(400).json({ message: "Username 4-20 belgi: kichik harf, raqam, '_' bo'lishi kerak." });
      }

      const [byEmail] = await db.select().from(users).where(eq(users.email, emailStr));
      if (byEmail) return res.status(409).json({ message: "Ushbu email allaqachon ro'yxatdan o'tgan" });
      const [byNick] = await db.select().from(users).where(ilike(users.firstName, escapeLike(uname)));
      if (byNick) return res.status(409).json({ message: "Ushbu username band, boshqasini tanlang" });

      const code = genCode();
      // Shu emailning oldingi kodlarini o'chirib, yangisini yozamiz.
      await db.delete(verificationCodes).where(and(eq(verificationCodes.channel, "email"), eq(verificationCodes.identifier, emailStr)));
      await db.insert(verificationCodes).values({
        channel: "email", identifier: emailStr, code, purpose: "register",
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });

      // sendEmail throw qilsa -> catch -> 500. Sukut bilan "yuborildi" QAYTARMAYMIZ.
      await sendEmail(emailStr, "YOZGO: Email tasdiqlash kodi", `Email tasdiqlash kodingiz: ${code}\nUshbu kod 5 daqiqa davomida amal qiladi.`);
      res.status(200).json({ message: "Email kodi yuborildi" });
    } catch (e) {
      console.error("[AUTH] email-otp:", e);
      res.status(500).json({ message: "Email yuborilmadi. Iltimos keyinroq urinib ko'ring." });
    }
  });

  // ============ TELEGRAM kanal: deep-link token yaratish ============
  app.post("/api/auth/telegram/start", otpLimiter, async (req: Request, res: Response) => {
    try {
      const purpose = req.body?.purpose === "login" ? "login" : "register";
      const token = crypto.randomBytes(16).toString("hex");
      const code = genCode();
      await db.insert(verificationCodes).values({
        channel: "telegram", identifier: token, token, code, purpose,
        telegramId: null, expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
      res.status(200).json({ token, deepLink: botDeepLink(token) });
    } catch (e) {
      console.error("[AUTH] telegram/start:", e);
      res.status(500).json({ message: "Telegram ulanishini boshlashda xatolik" });
    }
  });

  // Telegram holati (poll): user Start bosib telegram_id bog'landimi?
  app.get("/api/auth/telegram/status", async (req: Request, res: Response) => {
    try {
      const token = String(req.query.token || "");
      if (!token) return res.status(400).json({ bound: false });
      const [row] = await db.select().from(verificationCodes)
        .where(and(eq(verificationCodes.channel, "telegram"), eq(verificationCodes.token, token)));
      const bound = !!(row && row.telegramId && row.expiresAt > new Date());
      res.status(200).json({ bound });
    } catch {
      res.status(500).json({ bound: false });
    }
  });

  // ============ Kanal tasdiqlash: email kodi ============
  app.post("/api/auth/register/verify-email", codeVerifyLimiter, async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).json({ message: "Email va kod kiritilmadi" });
      const emailStr = String(email).toLowerCase().trim();

      const [row] = await db.select().from(verificationCodes).where(and(
        eq(verificationCodes.channel, "email"),
        eq(verificationCodes.identifier, emailStr),
        eq(verificationCodes.code, String(code)),
        eq(verificationCodes.purpose, "register"),
        gt(verificationCodes.expiresAt, new Date()),
      ));
      if (!row) return res.status(400).json({ message: "Email kodi xato yoki muddati o'tgan" });

      // Bir martalik isbot: verified qator SHU brauzer sessiyasiga bog'lanadi —
      // final register emailToken'ni talab qiladi. Aks holda 30 daqiqalik oynada
      // begona odam faqat email'ni bilib turib verified qatorni o'zlashtira olardi.
      const emailToken = crypto.randomBytes(16).toString("hex");
      await db.update(verificationCodes)
        .set({ verified: true, token: emailToken, expiresAt: new Date(Date.now() + VERIFIED_TTL_MS) })
        .where(eq(verificationCodes.id, row.id));
      res.status(200).json({ verified: true, emailToken });
    } catch (e) {
      console.error("[AUTH] verify-email:", e);
      res.status(500).json({ message: "Tasdiqlashda xatolik" });
    }
  });

  // ============ Kanal tasdiqlash: Telegram kodi ============
  app.post("/api/auth/register/verify-telegram", codeVerifyLimiter, async (req: Request, res: Response) => {
    try {
      const { token, code } = req.body;
      if (!token || !code) return res.status(400).json({ message: "Token va kod kiritilmadi" });

      const [row] = await db.select().from(verificationCodes).where(and(
        eq(verificationCodes.channel, "telegram"),
        eq(verificationCodes.token, String(token)),
        eq(verificationCodes.code, String(code)),
        gt(verificationCodes.expiresAt, new Date()),
      ));
      if (!row) return res.status(400).json({ message: "Telegram kodi xato yoki muddati o'tgan" });
      if (!row.telegramId) return res.status(400).json({ message: "Telegram tasdiqlanmagan — botda Start bosib raqamingizni yuboring." });

      await db.update(verificationCodes)
        .set({ verified: true, expiresAt: new Date(Date.now() + VERIFIED_TTL_MS) })
        .where(eq(verificationCodes.id, row.id));
      res.status(200).json({ verified: true });
    } catch (e) {
      console.error("[AUTH] verify-telegram:", e);
      res.status(500).json({ message: "Tasdiqlashda xatolik" });
    }
  });

  // ============ REGISTER (email + Telegram — IKKALASI verify qilingan bo'lishi shart) ============
  app.post("/api/auth/register", authAttemptLimiter, async (req: Request, res: Response) => {
    try {
      const { username, email, password, gender, emailToken, telegramToken } = req.body;
      if (!username || !email || !password || !emailToken || !telegramToken) {
        return res.status(400).json({ message: "Barcha maydonlar majburiy: username, email, parol, tasdiqlangan email va Telegram." });
      }
      if (gender !== "male" && gender !== "female") {
        return res.status(400).json({ message: "Jins tanlanishi shart (o'g'il bola/qiz bola)." });
      }

      const emailStr = String(email).toLowerCase().trim();
      const uname = String(username).trim().toLowerCase();
      if (!NICKNAME_REGEX.test(uname)) {
        return res.status(400).json({ message: "Username 4-20 belgi: kichik harf, raqam, '_' bo'lishi kerak." });
      }
      if (String(password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Parol kamida ${MIN_PASSWORD_LENGTH} belgidan iborat bo'lishi kerak` });
      }

      const now = new Date();
      // 1) Email kanali OLDIN verify-email orqali tasdiqlangan bo'lishi shart.
      // emailToken — verify-email qaytargan bir martalik isbot (sessiya bog'lash).
      const [emailRow] = await db.select().from(verificationCodes).where(and(
        eq(verificationCodes.channel, "email"),
        eq(verificationCodes.identifier, emailStr),
        eq(verificationCodes.token, String(emailToken)),
        eq(verificationCodes.purpose, "register"),
        eq(verificationCodes.verified, true),
        gt(verificationCodes.expiresAt, now),
      ));
      if (!emailRow) return res.status(400).json({ message: "Email tasdiqlanmagan. Avval email kodini tasdiqlang." });

      // 2) Telegram kanali OLDIN verify-telegram orqali tasdiqlangan bo'lishi shart
      const [tgRow] = await db.select().from(verificationCodes).where(and(
        eq(verificationCodes.channel, "telegram"),
        eq(verificationCodes.token, String(telegramToken)),
        eq(verificationCodes.verified, true),
        gt(verificationCodes.expiresAt, now),
      ));
      if (!tgRow || !tgRow.telegramId) return res.status(400).json({ message: "Telegram tasdiqlanmagan. Avval Telegram kodini tasdiqlang." });

      // 3) Unikallik: email, username, telegram_id
      const [byEmail] = await db.select().from(users).where(eq(users.email, emailStr));
      if (byEmail) return res.status(409).json({ message: "Ushbu email allaqachon ro'yxatdan o'tgan" });
      const [byNick] = await db.select().from(users).where(ilike(users.firstName, escapeLike(uname)));
      if (byNick) return res.status(409).json({ message: "Ushbu username band, boshqasini tanlang" });
      const [byTg] = await db.select().from(users).where(eq(users.telegramId, tgRow.telegramId));
      if (byTg) return res.status(409).json({ message: "Ushbu Telegram allaqachon ro'yxatdan o'tgan" });

      // 4) User yaratish { username, email(verified), password(bcrypt), telegram_id }
      const hashedPassword = await bcrypt.hash(String(password), 10);
      const [newUser] = await db.insert(users).values({
        email: emailStr,
        password: hashedPassword,
        firstName: uname,
        telegramId: tgRow.telegramId,
        phone: tgRow.phone ?? null,
        gender,
        role: (process.env.ADMIN_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).includes(emailStr) ? "admin" : "user",
      }).returning();

      // Ishlatilgan kodlarni o'chirish
      await db.delete(verificationCodes).where(eq(verificationCodes.id, emailRow.id));
      await db.delete(verificationCodes).where(eq(verificationCodes.id, tgRow.id));

      (req.session as any).userId = newUser.id;
      await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

      sendAdminNotification(
        `🔔 <b>YANGI FOYDALANUVCHI!</b>\n👤 ${newUser.firstName}\n📧 ${newUser.email}\n📱 TG: ${newUser.telegramId}\n🆔 ${newUser.id}`,
      ).catch(console.error);

      const { password: _pw, ...userNoHash } = newUser;
      res.status(201).json({ ...userNoHash, token: req.sessionID });
    } catch (error) {
      console.error("[AUTH] register:", error);
      res.status(500).json({ message: "Ro'yxatdan o'tishda xatolik yuz berdi" });
    }
  });

  // ============ LOGIN (a): email/username + parol ============
  app.post("/api/auth/login", authAttemptLimiter, async (req: Request, res: Response) => {
    try {
      const { emailOrUsername, email, password } = req.body;
      const idRaw = emailOrUsername ?? email;
      if (!idRaw || !password) return res.status(400).json({ message: "Login (email/username) va parol kiritilmadi" });
      const id = String(idRaw).trim().toLowerCase();

      const [userMatch] = await db.select().from(users).where(or(eq(users.email, id), ilike(users.firstName, escapeLike(id))));
      if (!userMatch || !userMatch.password) return res.status(401).json({ message: "Login yoki parol xato" });

      const ok = await bcrypt.compare(String(password).trim(), userMatch.password);
      if (!ok) return res.status(401).json({ message: "Login yoki parol xato" });
      if (userMatch.isBanned) return res.status(403).json({ message: "Sizning hisobingiz bloklangan. Administrator bilan bog'laning." });

      (req.session as any).userId = userMatch.id;
      await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

      const { password: _pw, ...safeProfile } = userMatch;
      res.status(200).json({ ...safeProfile, token: req.sessionID });
    } catch (error) {
      console.error("[AUTH] login:", error);
      res.status(500).json({ message: "Tizimga kirishda xatolik" });
    }
  });

  // ============ LOGIN (b): Telegram (bitta usul yetadi) ============
  app.post("/api/auth/login/telegram", authAttemptLimiter, async (req: Request, res: Response) => {
    try {
      const { token, code } = req.body;
      if (!token || !code) return res.status(400).json({ message: "Token va kod kiritilmadi" });
      const now = new Date();
      const [row] = await db.select().from(verificationCodes).where(and(
        eq(verificationCodes.channel, "telegram"),
        eq(verificationCodes.token, String(token)),
        eq(verificationCodes.code, String(code)),
        gt(verificationCodes.expiresAt, now),
      ));
      if (!row) return res.status(400).json({ message: "Kod xato yoki muddati o'tgan" });
      if (!row.telegramId) return res.status(400).json({ message: "Telegram tasdiqlanmagan — botda Start bosing." });

      const [userMatch] = await db.select().from(users).where(eq(users.telegramId, row.telegramId));
      if (!userMatch) return res.status(404).json({ message: "Bu Telegram hech qaysi hisobga bog'lanmagan. Avval ro'yxatdan o'ting." });
      if (userMatch.isBanned) return res.status(403).json({ message: "Sizning hisobingiz bloklangan." });

      await db.delete(verificationCodes).where(eq(verificationCodes.id, row.id));
      (req.session as any).userId = userMatch.id;
      await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

      const { password: _pw, ...safeProfile } = userMatch;
      res.status(200).json({ ...safeProfile, token: req.sessionID });
    } catch (error) {
      console.error("[AUTH] login/telegram:", error);
      res.status(500).json({ message: "Telegram login xatosi" });
    }
  });

  // ============ PASSWORD RESET ============

  app.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email talab qilinadi" });

      const [userMatch] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!userMatch) {
        // Enumeration'ni oldini olish uchun mavjud bo'lmasa ham 200.
        return res.json({ message: "Email ga ko'rsatma yuborildi" });
      }

      const expiry = Date.now() + 15 * 60 * 1000; // 15 daqiqa
      const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET + userMatch.password).update(`${userMatch.id}:${expiry}`).digest("hex");
      const resetToken = encodeURIComponent(`${userMatch.id}:${expiry}:${signature}`);

      const frontendUrl = process.env.NODE_ENV === "production" ? "https://yozgo.uz" : "http://localhost:5173";
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

      await sendEmail(
        userMatch.email,
        "YOZGO: Parolni Tiklash",
        `Parolni tiklash so'rovi.\n\n📧 Login: ${userMatch.email}\n🔗 Havola: ${resetLink}\n\nHavola muddati 15 daqiqa.`,
      );

      sendAdminNotification(`🔐 <b>Parol tiklash so'rovi:</b>\n👤 ${userMatch.email}`).catch(() => {});
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
      if (Date.now() > expiry) return res.status(400).json({ message: "Token muddati tugagan" });

      const [userMatch] = await db.select().from(users).where(eq(users.id, userId));
      if (!userMatch) return res.status(400).json({ message: "Foydalanuvchi topilmadi" });

      const expectedSignature = crypto.createHmac("sha256", process.env.SESSION_SECRET + userMatch.password).update(`${userId}:${expiryStr}`).digest("hex");
      if (signature !== expectedSignature) return res.status(400).json({ message: "Token haqiqiy emas yoki bekor qilingan" });

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
      if (!userId) return res.status(401).json({ message: "Avtorizatsiyadan o'tilmagan" });

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ message: "Joriy va yangi parolni kiriting" });

      const safeNewPassword = newPassword.trim();
      if (safeNewPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Yangi parol kamida ${MIN_PASSWORD_LENGTH} ta belgi bo'lishi kerak` });
      }

      const [userMatch] = await db.select().from(users).where(eq(users.id, userId));
      if (!userMatch) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!userMatch.password) return res.status(400).json({ message: "Bu hisobda parol o'rnatilmagan. Parolni tiklang." });

      const isCurrentValid = await bcrypt.compare(String(currentPassword).trim(), userMatch.password);
      if (!isCurrentValid) return res.status(403).json({ message: "Joriy parol noto'g'ri" });

      const hashedNewPassword = await bcrypt.hash(safeNewPassword, 10);
      await db.update(users).set({ password: hashedNewPassword }).where(eq(users.id, userMatch.id));
      res.status(200).json({ message: "Parol muvaffaqiyatli o'zgartirildi" });
    } catch (error) {
      console.error("[AUTH] Update password error:", error);
      res.status(500).json({ message: "Parolni o'zgartirishda xatolik yuz berdi" });
    }
  });

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    const activeUserId = (req.session as any).userId;
    if (!activeUserId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const [foundUser] = await db.select().from(users).where(eq(users.id, activeUserId));
      if (!foundUser) return res.status(401).json({ message: "Unauthorized" });

      if (foundUser.isBanned) {
        req.session.destroy(() => {});
        return res.status(403).json({ message: "Sizning hisobingiz bloklangan." });
      }

      const { password: _pw, ...userSummary } = foundUser;
      res.json({ ...userSummary, token: req.sessionID });
    } catch (error) {
      res.status(500).json({ message: "Internal error" });
    }
  });

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

      if (user.lastNicknameChangeAt) {
        const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
        const timePassed = Date.now() - new Date(user.lastNicknameChangeAt).getTime();
        if (timePassed < ninetyDaysInMs) {
          const daysLeft = Math.ceil((ninetyDaysInMs - timePassed) / (1000 * 60 * 60 * 24));
          return res.status(403).json({ message: `Nicknameni o'zgartirish uchun yana ${daysLeft} kun kutishingiz kerak` });
        }
      }

      const [existing] = await db.select().from(users).where(eq(users.firstName, formattedNickname));
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "Bu nickname allaqachon band, boshqasini tanlang" });
      }

      await db.update(users).set({ firstName: formattedNickname, lastNicknameChangeAt: new Date() }).where(eq(users.id, userId));
      res.json({ message: "Nickname muvaffaqiyatli o'zgartirildi" });
    } catch (error) {
      console.error("[AUTH] Nickname update error:", error);
      res.status(500).json({ message: "Xatolik yuz berdi" });
    }
  });

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
