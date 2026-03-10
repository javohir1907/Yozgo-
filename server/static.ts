import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");
  
  console.log("Static files path:", distPath);
  
  if (!fs.existsSync(distPath)) {
    const distPath2 = path.resolve(process.cwd(), "public");
    if (!fs.existsSync(distPath2)) {
      throw new Error(
        `Could not find the build directory: ${distPath}`
      );
    }
    app.use(express.static(distPath2));
    app.use("/{*path}", (_req, res) => {
      res.sendFile(path.resolve(distPath2, "index.html"));
    });
    return;
  }
  
  app.use(express.static(distPath));
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
