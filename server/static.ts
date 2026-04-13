import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist");
  const publicPath = path.resolve(process.cwd(), "public");

  let finalPath = "";

  if (fs.existsSync(path.join(distPath, "index.html"))) {
    finalPath = distPath;
  } else if (fs.existsSync(path.join(publicPath, "index.html"))) {
    finalPath = publicPath;
  }

  if (!finalPath) {
    console.error("❌ [SYSTEM] ERROR: No static files (index.html) found in 'dist' or 'public'!");
    return;
  }

  console.log(`🚀 [SYSTEM] Serving static files from: ${finalPath}`);
  
  // Serve hashed assets with aggressive caching
  app.use("/assets", express.static(path.join(finalPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  // Serve other static assets
  app.use(express.static(finalPath, { index: false, maxAge: "1h" }));

  // CATCH-ALL ROUTE: Must be last to handle SPA routing without swallowing API calls
  app.use((req, res, next) => {
    // If the request is for /api, don't serve index.html
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(finalPath, "index.html"));
  });
}
