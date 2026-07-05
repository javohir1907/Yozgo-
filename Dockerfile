# 1. Build bosqichi
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Production bosqichi (Yengil va xavfsiz)
FROM node:20-alpine AS runner
WORKDIR /app

# Runtime (dist/index.js bundle) + node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# `npm start` boot'da `drizzle-kit push` ishlaydi — unga drizzle.config.ts + schema
# manbasi (shared/) + tsconfig kerak (dist bundle'da emas, alohida CLI).
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/shared ./shared

# winston logs/ katalogini node foydalanuvchisi yoza olishi uchun oldindan yaratamiz
# (aks holda USER node /app ichida katalog ocholmaydi).
RUN mkdir -p /app/logs && chown -R node:node /app/logs

# Muhit o'zgaruvchilari (Coolify o'z PORT'ini bersa, ilova process.env.PORT'ni hurmat qiladi)
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Konteyner ichki healthcheck (Coolify o'z healthcheck'iga qo'shimcha). Node 20 global
# fetch — qo'shimcha curl/wget kerak emas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Xavfsizlik: Dasturni root huquqisiz ishga tushirish
USER node

CMD ["npm", "start"]
