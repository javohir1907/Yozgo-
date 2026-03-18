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

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: ws: https: http:; font-src 'self' https://fonts.gstatic.com data:; require-trusted-types-for 'script'; trusted-types default 'allow-duplicates'"
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

app.use(helmet({
  contentSecurityPolicy: false, // We are setting this manually above
  hsts: false, // We are setting this manually above
  frameguard: false, // We are setting X-Frame-Options manually above
  permittedCrossDomainPolicies: true,
}));

app.use(cors({
  origin: ["https://yozgo-frontend.onrender.com", "http://localhost:5000", "http://localhost:5173", "https://yozgo.uz", "https://www.yozgo.uz"],
  credentials: true
}));
app.use(cookieParser());

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
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
    `);

    await pool.query(`
      UPDATE users SET role = 'admin' WHERE username = 'javohir1907' AND email = 'xolmatovjavohir911@gmail.com';
    `);
    
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
        is_active boolean DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS advertisements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        image_url text NOT NULL,
        link_url text NOT NULL,
        start_date timestamp NOT NULL,
        end_date timestamp NOT NULL,
        is_active boolean DEFAULT true
      );
    `);
    console.log("DB migration completed directly from index!");
  } catch (err) {
    console.warn("DB Startup migration failed (probably already applied):", err);
  }

  await registerRoutes(httpServer, app);
  app.use("/api", debugRouter);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

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
    },
  );
})();
