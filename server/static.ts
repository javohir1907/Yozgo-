import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");
  const distPath2 = path.resolve(process.cwd(), "public");

  console.log("Trying dist/public:", distPath);
  console.log("Trying public:", distPath2);

  let finalPath = "";

  if (fs.existsSync(distPath)) {
    finalPath = distPath;
  } else if (fs.existsSync(distPath2)) {
    finalPath = distPath2;
  } else {
    console.error("No static files found! Checked:", distPath, distPath2);
    return;
  }

  console.log("Serving static from:", finalPath);
  app.use(express.static(finalPath));

  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(finalPath, "index.html"));
  });
}
