const fs = require('fs');
let code = fs.readFileSync('server/routes.ts', 'utf8');

const newImports = `import { db } from "./db";
import { eq, sql, desc, and, ne } from "drizzle-orm";
import { testResults, users, battles, roomAccessCodes, battleParticipants, competitions, advertisements, notifications, competitionParticipants } from "@shared/schema";`;

code = code.replace(/import { setupAuth, isAuthenticated } from "\.\/auth";/, `import { setupAuth, isAuthenticated } from "./auth";\n${newImports}`);

code = code.replace(/const\s*{\s*db\s*}\s*=\s*await\s*import\("\.\/db"\);\n?/g, "");
code = code.replace(/const\s*{\s*[^}]*\s*}\s*=\s*await\s*import\("@shared\/schema"\);\n?/g, "");
code = code.replace(/const\s*{\s*[^}]*\s*}\s*=\s*await\s*import\("drizzle-orm"\);\n?/g, "");

fs.writeFileSync('server/routes.ts', code);
console.log("Imports updated successfully!");
