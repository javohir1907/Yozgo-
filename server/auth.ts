import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import passport from "passport";
import type { Express, RequestHandler, Request, Response, NextFunction } from "express";
import { db, pool } from "./db";
import { users } from "@shared/models/auth";
import { eq, ilike } from "drizzle-orm";


export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "yozgo-super-secret-key",
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: sessionTtl,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      // FIX: case-insensitive nickname uniqueness check (Ali vs ali vs ALI barchasi bir xil)
      if (firstName && firstName.trim()) {
        const [existingName] = await db.select().from(users).where(ilike(users.firstName, firstName.trim()));
        if (existingName) {
          return res.status(409).json({ message: "Bu nickname allaqachon band, boshqa nom tanlang" });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [user] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName: firstName ? firstName.trim() : null,
          lastName: lastName || null,
        })
        .returning();

      (req.session as any).userId = user.id;
      const { password: _, ...safeUser } = user;
      
      const { sendTelegramAlert } = await import("./telegram");
      sendTelegramAlert(`🚨 <b>Yangi foydalanuvchi!</b>\n\n<b>Email:</b> ${email.toLowerCase()}\n<b>Nickname:</b> ${firstName ? firstName.trim() : "Yo'q"}`);
      
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register: " + (error as any).message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      (req.session as any).userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to log in: " + (error as any).message });
    }
  });

  app.post("/api/auth/telegram", async (req, res) => {
    try {
      const { initData } = req.body;
      if (!initData) return res.status(400).json({ message: "initData is required" });

      const crypto = await import("crypto");
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');
      
      const keys = Array.from(urlParams.keys()).sort();
      const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\\n');
      
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN || '').digest();
      const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      
      if (hmac !== hash) {
        return res.status(401).json({ message: "Telegram auth validation failed" });
      }
      
      const userStr = urlParams.get('user');
      if (!userStr) return res.status(400).json({ message: "No user dat found" });
      const tgUser = JSON.parse(userStr);
      
      let [user] = await db.select().from(users).where(eq(users.telegramId, String(tgUser.id)));
      
      if (!user) {
        // Find by username if email matching exists? Telegram gives username, first_name, last_name, photo_url
        // Let's create an auto-generated account
        const randomPass = crypto.randomBytes(16).toString("hex");
        const dummyEmail = `tg_${tgUser.id}@telegram.local`;
        const hashedPassword = await bcrypt.hash(randomPass, 10);
        
        [user] = await db.insert(users).values({
          email: dummyEmail,
          password: hashedPassword,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name || null,
          telegramId: String(tgUser.id),
          profileImageUrl: tgUser.photo_url || null
        }).returning();
        
        const { sendTelegramAlert } = await import("./telegram");
        sendTelegramAlert(`🚨 <b>Yangi Telegram Foydalanuvchi qoshildi!</b>\\n\\n<b>ID:</b> ${tgUser.id}\\n<b>Ismi:</b> ${tgUser.first_name}`);
      }

      (req.session as any).userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Telegram auth error:", error);
      res.status(500).json({ message: "Failed to authenticate with Telegram" });
    }
  });

  app.get("/api/auth/user", async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // FIX: Real-time username check route
  app.get("/api/auth/check-username", async (req, res) => {
    const { username } = req.query;
    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ message: "Username query parameter is required" });
    }

    try {
      const [existingName] = await db.select().from(users).where(ilike(users.firstName, username.trim()));
      if (existingName) {
        return res.json({ available: false });
      }
      return res.json({ available: true });
    } catch (error) {
      console.error("Error checking username:", error);
      res.status(500).json({ message: "Failed to check username" });
    }
  });

  // FIX: Parolni yangilash route qo'shildi
  app.post("/api/auth/update-password", async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Password update error:", error);
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.sendStatus(200);
    });
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if ((req.session as any).userId) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
}
