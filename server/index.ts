import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import debugRouter from "./debug-auth";
import helmet from "helmet";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

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

// Add Permissions-Policy since Helmet doesn't support it directly yet.
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

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

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("Running guaranteed DB migrations from index.ts...");

    // Tizimga faqat bir marta ishlaydigan va keyin o'zini bloklaydigan o'chirish logikasi:
    await pool.query(`CREATE TABLE IF NOT EXISTS _one_time_reset (done boolean);`);
    const resetCheck = await pool.query(`SELECT * FROM _one_time_reset;`);

    if (resetCheck.rowCount === 0) {
      console.log("Running ONE-TIME users database wipe...");
      // UUID ishlatilgani uchun sequence restart qilinmaydi va xato beradi!
      // CASCADE qilib barcha usersga bog'langan eski result/review larni ham tozalash:
      await pool.query(`TRUNCATE TABLE users CASCADE;`);
      await pool.query(`INSERT INTO _one_time_reset (done) VALUES (true);`);
      console.log("Wipe completed successfully.");
    }

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id varchar UNIQUE;
    `);

    try {
      await pool.query(`
        UPDATE users SET role = 'admin' WHERE email = 'xolmatovjavohir911@gmail.com';
      `);
    } catch (e) {
      console.error("Admin setup failed:", e);
    }

    // Also ensuring tables are handled here because Render might skip NPM start phase
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id) NOT NULL,
        rating integer NOT NULL,
        comment text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS competitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        prize text,
        date timestamp NOT NULL,
        participants_count integer DEFAULT 0,
        winner_name text,
        is_active boolean DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS competition_participants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        competition_id uuid REFERENCES competitions(id) NOT NULL,
        user_id varchar REFERENCES users(id) NOT NULL,
        registered_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        message text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );

      ALTER TABLE competitions ADD COLUMN IF NOT EXISTS participants_count integer DEFAULT 0;
      ALTER TABLE competitions ADD COLUMN IF NOT EXISTS winner_name text;
      CREATE TABLE IF NOT EXISTS advertisements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        description text,
        image_url text NOT NULL,
        link_url text NOT NULL,
        start_date timestamp NOT NULL,
        end_date timestamp NOT NULL,
        is_active boolean DEFAULT true,
        clicks integer DEFAULT 0
      );
      ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS description text;
      ALTER TABLE advertisements ADD COLUMN IF NOT EXISTS clicks integer DEFAULT 0;

      CREATE TABLE IF NOT EXISTS test_results (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id),
        wpm integer NOT NULL,
        accuracy integer NOT NULL,
        language text NOT NULL,
        mode text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS leaderboard_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar REFERENCES users(id) NOT NULL,
        wpm integer NOT NULL,
        accuracy integer NOT NULL,
        language text NOT NULL,
        period text NOT NULL,
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS battles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        status text NOT NULL,
        language text NOT NULL,
        mode text NOT NULL,
        creator_id varchar REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now()
      );
      ALTER TABLE battles ADD COLUMN IF NOT EXISTS creator_id varchar REFERENCES users(id);

      CREATE TABLE IF NOT EXISTS battle_participants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        battle_id uuid REFERENCES battles(id) NOT NULL,
        user_id varchar REFERENCES users(id) NOT NULL,
        wpm integer,
        accuracy integer,
        is_winner boolean DEFAULT false,
        ip_address varchar,
        agreed_at timestamp,
        joined_at timestamp NOT NULL DEFAULT now()
      );
      ALTER TABLE battle_participants ADD COLUMN IF NOT EXISTS ip_address varchar;
      ALTER TABLE battle_participants ADD COLUMN IF NOT EXISTS agreed_at timestamp;

      CREATE TABLE IF NOT EXISTS room_access_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id uuid REFERENCES battles(id) NOT NULL,
        user_id varchar REFERENCES users(id),
        code text NOT NULL UNIQUE,
        is_used boolean DEFAULT false,
        used_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );

    `);
    console.log("DB migration completed directly from index!");
  } catch (err) {
    console.warn("DB Startup migration failed (probably already applied):", err);
  }

  // Barcha jadvallar faol bo'lgandan so'ng botlarni ishga tushirish:
  const { startBot } = require("./bot");
  const { startUserBot } = require("./userBot");
  startBot();
  startUserBot();

  await registerRoutes(httpServer, app);
  app.use("/api", debugRouter);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);
    if (status === 500) {
      import("./telegram").then(({ sendTelegramAlert }) => {
        sendTelegramAlert(
          `❌ <b>500 Xatolik!</b>\n\n<b>Yo'l:</b> ${_req.path}\n<b>Xato:</b> ${message}\n<pre>${err.stack?.substring(0, 500)}</pre>`
        );
      });
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
