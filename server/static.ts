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
    // Fail gracefully but loudly in logs
    app.get("*", (_req, res) => {
      res.status(500).send("Static files not found. Please run 'npm run build' first.");
    });
    return;
  }

  console.log(`🚀 [SYSTEM] Serving static files from: ${finalPath}`);
  
  // Serve hashed assets with aggressive caching
  // Vite puts build assets in 'assets' folder
  const assetsPath = path.join(finalPath, "assets");
  if (fs.existsSync(assetsPath)) {
    app.use("/assets", express.static(assetsPath, {
      maxAge: "1y",
      immutable: true,
      fallthrough: false // If an asset is missing in /assets, return 404
    }));
  }

  // Serve other static assets (favicon, etc.)
  app.use(express.static(finalPath, { index: false, maxAge: "1h" }));

  // CATCH-ALL ROUTE: Must be last to handle SPA routing
  app.use((req, res, next) => {
    // If the request is for /api or has an extension (likely a missing asset), don't serve index.html
    if (req.path.startsWith("/api") || req.path.includes(".")) {
      return next();
    }
    
    const indexPath = path.resolve(finalPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}
