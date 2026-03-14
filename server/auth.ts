import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import passport from "passport";
import type { Express, RequestHandler } from "express";
import { db, pool } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";


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


      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      // Check username (firstName) uniqueness
      if (firstName && firstName.trim()) {
        const [existingName] = await db.select().from(users).where(eq(users.firstName, firstName.trim()));
        if (existingName) {
          return res.status(409).json({ message: "Bu nik band, boshqa nik tanlang" });
        }
      }


      const hashedPassword = await bcrypt.hash(password, 10);
      const [user] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          firstName: firstName ? firstName.trim() : null,
          lastName: lastName || null,
        })
        .returning();


      (req.session as any).userId = user.id;
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register: " + (error as any).message, stack: (error as any).stack });
    }
  });


  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;


      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }


      const [user] = await db.select().from(users).where(eq(users.email, email));
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
      res.status(500).json({ message: "Failed to log in: " + (error as any).message, stack: (error as any).stack });
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
      res.status(500).json({ message: "Failed to fetch user: " + (error as any).message, stack: (error as any).stack });
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
