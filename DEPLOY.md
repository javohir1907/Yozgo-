# YOZGO — Coolify Deploy Qo'llanmasi

AlphaVPS + Coolify + self-hosted PostgreSQL + Cloudflare uchun.

Ilova **bitta konteyner**: Express server ham API'ni, ham build qilingan React
client'ni (static) `PORT`da xizmat qiladi. Migratsiyalar **boot'da avtomatik** ishlaydi.

---

## 1. Talablar
- Coolify o'rnatilgan server (AlphaVPS).
- PostgreSQL — Coolify'da alohida resurs (internal network, odatda **SSL'siz**).
- Domen Cloudflare orqasida (proxied).
- Git repo (GitHub/GitLab) — Coolify shundan build qiladi.

> Redis KERAK EMAS — session PostgreSQL'da saqlanadi (`connect-pg-simple`).

---

## 2. Environment o'zgaruvchilari (Coolify → Environment Variables)

### Majburiy
| Kalit | Namuna / izoh |
|---|---|
| `DATABASE_URL` | `postgres://user:pass@<postgres-service>:5432/yozgo` — Coolify Postgres'ning **internal** hostnomi. Self-hosted odatda SSL'siz (`DB_SSL` bo'sh qoldiring). |
| `SESSION_SECRET` | Uzun tasodifiy satr (masalan `openssl rand -hex 32`). **Bo'sh bo'lsa server ishga tushmaydi.** |
| `NODE_ENV` | `production` (Dockerfile allaqachon o'rnatadi; lekin aniq bo'lsin). |

### Muhim (tavsiya)
| Kalit | Izoh |
|---|---|
| `RUN_CRON` | `true` — streak eslatma (19:00) + haftalik rollover/liga reset (Dushanba 00:00) cron'larini yoqadi. **⚠️ FAQAT BITTA instansiyada `true` qiling** (pastga qarang). Standart: `false`. |
| `PORT` | Coolify odatda o'zi beradi; ilova `process.env.PORT`ni hurmat qiladi (standart 5000). |
| `DB_SSL` | Self-hosted non-SSL Postgres uchun **BO'SH qoldiring**. Managed/SSL DB uchun `true` (yoki `DATABASE_URL`ga `?sslmode=require`). |
| `DB_CA_CERT` | (ixtiyoriy) CA sertifikat PEM — qat'iy TLS tekshiruvi. |

### Integratsiyalar (ixtiyoriy — bo'sh bo'lsa o'sha funksiya o'chadi, server ishlaydi)
| Kalit | Izoh |
|---|---|
| `USER_BOT_TOKEN` | Telegram user-bot (xona kodi, streak/g'olib eslatmalari). |
| `TELEGRAM_BOT_TOKEN` / `ADMIN_BOT_TOKEN` | Admin bildirishnomalari. |
| `ADMIN_CHAT_ID` / `ADMIN_TELEGRAM_ID` | Admin Telegram chat id. |
| `ADMIN_EMAILS` | Vergul bilan — admin huquqi beriladigan emaillar. |
| `BOT_SECRET` / `ADMIN_API_TOKEN` | Admin REST API siri (`x-bot-secret`/`x-admin-token`). Uzun tasodifiy. |
| `BACKEND_URL` | Google OAuth callback uchun (masalan `https://yozgo.uz`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (yoki `GOOGLE_ID`/`GOOGLE_SECRET`) | Google OAuth. |
| `SMTP_USER` / `SMTP_PASS` | Email (OTP, parol tiklash) — nodemailer orqali. |
| `SENTRY_DSN` | **Bo'sh qoldiring** (Sentry standart o'chiq — quyida). |
| `VITE_API_BASE_URL` / `VITE_API_URL` | Frontend API bazasi (bir domenda serve qilinsa bo'sh qoldirish mumkin). |

> To'liq shablon: **`.env.example`** faylida.

---

## 3. Qadam-baqadam deploy

1. **Postgres resursi**: Coolify → New Resource → PostgreSQL. Yaratilgach uning
   **internal** ulanish satrini oling (`DATABASE_URL` uchun).
2. **Ilova**: Coolify → New Resource → Application → Git repo'ni ulang.
3. **Build pack**: repo'da **`Dockerfile` bor** — Coolify uni avtomatik ishlatadi
   (nixpacks kerak emas). Multi-stage: `npm ci` → `npm run build` → `npm start`.
4. **Port**: `5000` (Dockerfile `EXPOSE 5000`). Coolify domenni shunga map qiladi.
5. **Healthcheck**: yo'l = **`/api/health`**, port `5000` (200 qaytaradi). (Dockerfile'da
   ichki `HEALTHCHECK` ham bor.)
6. **Env**: yuqoridagi o'zgaruvchilarni kiriting. `DATABASE_URL` → Postgres internal host.
7. **Deploy**. Boot'da avtomatik: `drizzle-kit push` (asosiy jadvallar) → ichki
   idempotent `ALTER/CREATE IF NOT EXISTS` migratsiyalari → badge/liga/kosmetika seed.
   Ma'lumot **hech qachon DROP qilinmaydi** (additive).
8. **Cloudflare**: domenni Coolify'ga proxied (turuncha bulut) qiling. SSL rejimi
   **Full** (yoki Full strict). Ilovada `app.set('trust proxy', 1)` — `secure` cookie va
   real IP proksi orqasida to'g'ri ishlaydi.

---

## 4. ⚠️ Muhim ogohlantirishlar

- **`RUN_CRON=true` FAQAT BITTA instansiyada.** Bir necha replica bo'lsa, har biri
  cron'ni ishga tushirib **dublikat Telegram xabar** va **ikki marta liga reset** qiladi.
  Faqat bitta instansiyaga `RUN_CRON=true`, qolganlariga `false` (yoki bo'sh) qo'ying.
  Cron faqat `NODE_ENV=production` VA `RUN_CRON=true` bo'lgandagina ishlaydi.
- **`NODE_ENV=production` bo'lsin.** Aks holda `/api/debug-info` ochiladi va Vite dev
  rejimi yoqiladi.
- **`DB_SSL` self-hosted uchun BO'SH.** SSL'siz Postgres'da SSL majburlansa
  `"server does not support SSL connections"` xatosi barcha DB so'rovlarini buzadi.
- **`SESSION_SECRET` majburiy** (uzun tasodifiy) — bo'lmasa server ataylab to'xtaydi.
- **Sentry standart o'chiq.** `SENTRY_DSN` bo'sh bo'lsa umuman ishlamaydi (graceful).
  Berilsa — tracing **o'chiq** holda init qilinadi (Telegram token `:` / path-to-regexp
  konfliktidan qochish uchun) va try/catch bilan himoyalangan.

---

## 5. Deploy'dan keyin tekshirish

```bash
# 1) Health
curl https://<domen>/api/health         # -> {"status":"ok","uptime":...}

# 2) Loglarda (Coolify → Logs):
#    "SERVER BOUND TO PORT", "Bazaga barcha yangi ustunlar ... qo'shildi"
#    RUN_CRON=true bo'lsa: "Scheduled jobs (cron) are active."
```

3. Saytga kiring → ro'yxatdan o'ting → 1 ta test yozing → **profilda XP/level/streak**
   ko'rinishi kerak. `/league`, `/quests`, `/shop`, `/friends` sahifalari ochilsin.
4. (RUN_CRON=true bo'lsa) cron'ni tez sinash uchun jadval vaqtini vaqtincha o'zgartirib
   ko'rish mumkin, keyin qaytaring.

---

## 6. Migratsiya modeli (ma'lumot uchun)
- `drizzle-kit push` — `shared/schema.ts`dan asosiy jadvallarni yaratadi/yangilaydi
  (boot'da, `npm start` ichida). Dockerfile runner'ga `drizzle.config.ts` + `shared/` +
  `tsconfig.json` nusxalangan.
- `server/index.ts` startup — idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` va
  `CREATE TABLE IF NOT EXISTS` + seed (badge/liga/kosmetika). `push` biror sababdan
  o'tmasa ham, gamifikatsiya ustun/jadvallari shu blokdan qo'shiladi (data yo'qolmaydi).
