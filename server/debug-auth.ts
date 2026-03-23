import express from "express";

const router = express.Router();

router.get("/debug-info", (req: any, res) => {
  res.json({
    session: req.session,
    cookies: req.cookies || null,
    headers: {
      origin: req.headers.origin,
      cookie: req.headers.cookie,
      host: req.headers.host,
    },
    sessionID: req.sessionID,
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : "no passport",
    user: req.user || null,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      SESSION_SECRET: process.env.SESSION_SECRET ? "EXISTS" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? "EXISTS" : "MISSING",
    },
  });
});

export default router;
