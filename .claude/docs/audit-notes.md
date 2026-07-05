# YOZGO — Audit va Tuzatish Yozuvlari

> Bu hujjat 2026-07-05 dagi to'liq audit + tuzatish sessiyasini hujjatlaydi.
> Maqsad: gamifikatsiya (XP/streak/badge/league) qo'shishdan **oldin** loyihani
> 100% ishonchli va toza holatga keltirish. Gamifikatsiya hali qo'shilmagan.

Repo: `github.com/javohir1907/Yozgo-` · Stack: React+Vite+TS (client) /
Express+Drizzle+Postgres (server) / Socket.io (real-time battle) / Node Telegram userBot.

---

## 1. Audit usuli va umumiy natija

- Ko'p-agentli audit (parallel auditorlar) + har bir jiddiy topilma kod darajasida
  qo'lda adversarial tekshirildi.
- Boshlang'ich holat: **ishchi daraxt toza** (`tsc --noEmit` 0 xato, `npm run build` OK),
  lekin `origin/main` **buzilgan** edi — oldingi tuzatishlar commit qilinmagan.
- Yakuniy holat: barcha 6 bosqich + follow-up tugadi, `origin/main`ga push qilindi,
  `tsc --noEmit` 0 xato, `npm run build` muvaffaqiyatli. Rollback tag: `pre-audit-fixes`.

Har o'zgarishdan keyin `tsc --noEmit` (0 xato) va `npm run build` (OK) tasdiqlandi.

---

## 2. Asosiy 6 bug (kategoriya bo'yicha)

### 🔴 Bug 1 — Git: tuzatishlar commit qilinmagan, `origin/main` buzilgan
- `server/routes.ts` 33 qatorga qisqargan (to'liq: 1087), `server/battle-manager.ts`
  228 qatorlik stub (to'liq: 641), `server/auth.ts`da duplikatsiya (to'g'ri: 723).
- Buzuvchi commitlar: `7cef13b` (routes.ts −1073 qator), `77d2be3` (battle-manager
  o'chirilgan). Ishchi daraxtdagi to'liq versiyalar remote'ga hech qachon push qilinmagan.
- **Patch:** to'liq versiyalar commit + push qilindi. `logs/` git'dan chiqarildi,
  `.env.example` tracking'ga qaytarildi, `BOT_SECRET`/`ADMIN_API_TOKEN` hujjatlandi.
- Commitlar: `d9595c3`, `06b8945`. Tag: `pre-audit-fixes`.

### 🔴 Bug 2 — Xavfsizlik: maxfiy ma'lumot sızması va buzg'unchi startup
- **Session token log'ga chiqishi:** `server/index.ts` request-logger har bir `/api`
  javob tanasini winston'ga yozgan; login/register `token: req.sessionID` qaytaradi →
  tokenlar, parol hashlari, PII log fayllarga tushgan. Raw session ID `Authorization:
  Bearer`da to'liq auth sifatida qabul qilingan (`server/auth.ts`).
- **`TRUNCATE TABLE users CASCADE`** startup migratsiyasida (`server/index.ts:~196`) —
  `_clear_users_v2` bayrog'i o'chsa/yangi DB'da barcha foydalanuvchilar yo'qolardi.
  Xuddi shu anti-pattern `_clear_images_v1` (profil rasmlarini NULL qilish).
- **`GET /api/debug-info`** (`server/debug-auth.ts`) production'da himoyasiz — session,
  cookie, env holatini oshkor qilgan.
- **Admin endpointlari parol hashini qaytargan:** `/api/admin/users/top|search|:id`
  xom `db.select().from(users)` (`server/routes.ts`).
- **Stack trace client'ga:** battle-create catch (`server/routes.ts:~394`).
- **Admin emaillar hardcoded**, startup'da avto-admin. **DB TLS** `rejectUnauthorized:false`.
- **Patch:**
  - Response-body logging butunlay olib tashlandi (faqat metod/yo'l/status/vaqt).
  - `TRUNCATE` va `_clear_images_v1` bloklari o'chirildi.
  - `/api/debug-info` faqat `NODE_ENV !== production`da mount qilinadi.
  - `safeUserColumns` (password'siz) admin user endpointlarida ishlatiladi.
  - Stack/ichki xato client'ga bormaydi (serverda log qilinadi).
  - Admin emaillar `ADMIN_EMAILS` env'ga ko'chirildi.
  - DB TLS `DB_CA_CERT`-aware: CA berilsa qat'iy (`rejectUnauthorized:true`), aks holda
    ishlaydi + ogohlantirish (buzmaydigan yechim). Xuddi shu `script/migrate.ts`da.
- Commitlar: `4be9dd9`, `2870bb2`.

### 🔴 Bug 3 — 9 ta phantom API endpoint (runtime 404, buzilgan funksiyalar)
Client chaqiradigan, lekin serverda mavjud bo'lmagan endpointlar:
| Endpoint | Client | Ta'sir |
|---|---|---|
| `GET /api/auth/check-username` | `auth.tsx:57` | Har qanday nomni noto'g'ri "mavjud" ko'rsatgan |
| `GET/POST /api/reviews` | `landing.tsx` | Sharhlar (backend bor edi, route yo'q) |
| `POST /api/competitions/:id/register` | `landing.tsx:353` | Musobaqaga ro'yxat |
| `GET /api/competitions/:id/participants` | `landing.tsx:347` | Ishtirokchilar ro'yxati |
| `POST /api/advertisements/:id/click` | `banner.tsx` | Reklama klik |
| `GET/POST/PUT /api/admin/advertisements` | `admin.tsx` | Admin ads dashboard (nom + auth buzilgan) |
- **Patch:** yetishmagan routelar qo'shildi. `check-username` register bilan bir xil
  `ilike(users.firstName)` qoidasini ishlatadi. Admin ads: nomlash server konventsiyasiga
  (`/api/admin/ads*`) moslandi, auth `adminAuth` (bot-only) → `adminGuard` (session-admin
  YOKI bot token) qilindi, toggle route qo'shildi, integer id.
- Commit: `58e09e7`. (Keyinchalik reviews va ads butunlay o'chirildi — 3.2-bo'lim.)

### 🔴 Bug 4 — Real-time (Socket.io) oqim uzilishlari
1. **Natija saqlanmagan:** xona yaratuvchi va socket orqali kirganlarning `battle_participants`
   qatori yaratilmagan (faqat REST `/api/battles/join`da) → natijasi hech qachon saqlanmagan.
2. **Socket `join-room` REST himoyalarini chetlab o'tgan:** gender/access-code/ban.
3. **Global leaderboard yangilanmagan:** react-query kalit nomuvofiqligi (`["/api/leaderboard"]`
   vs `["/api/leaderboard?language=X"]`).
4. **Kech qo'shilgan o'yinchi `battle-start` olmagan** — kutish ekranida qotib qolgan.
5. **`start-battle` `room.settings`ni to'liq qayta yozgan** — DB'dan yuklangan
   `maxParticipants`/`genderRestriction` yo'qolgan.
6. **Server restart'da battle abadiy `playing`** — faol-jang statistikasini shishirgan.
7. **G'olib (`isWinner`) saqlanmagan**, battle natijalari leaderboard'ga tushmagan.
- **Patch (`server/battle-manager.ts`):**
  - `handleJoinRoom` `battle_participants` qatorini ta'minlaydi (creator + joinerlar).
  - Ban + gender DB'dagi ishonchli user'dan tekshiriladi; gender `checkGenderEligibility`
    (`server/utils/battle-access.ts`) — REST va socket **bir xil** funksiyani ishlatadi (DRY).
  - Leaderboard invalidatsiyasi `predicate` bilan barcha `/api/leaderboard*` kalitlarini yangilaydi.
  - Kech joiner'ga darhol `battle-start` yuboriladi.
  - `start-battle` settings'ni **merge** qiladi (`{...room.settings, ...incoming}`).
  - Startup'da orphaned `waiting`/`playing` battle'lar `finished` qilinadi.
  - `finishBattle` g'olibni `is_winner`ga yozadi + natijalarni `test_results`ga (keyinchalik
    `source='battle'` bilan — 3.3-bo'lim).
- Commit: `1e06acd`.

### ⚠️ Bug 5 — Schema/storage nomuvofiqligi va o'lik schema
- **CSV export** `users.username`ga havola qilgan (ustun yo'q) → har doim bo'sh.
- **`leaderboard_entries`** faqat yozilgan, hech qachon o'qilmagan (leaderboard aslida
  `test_results`dan `LeaderboardService` orqali hisoblanadi).
- **O'lik jadvallar/ustunlar:** `prize_winners`, `notifications`, `battle_participants.ipAddress`,
  `battle_participants.agreedAt`.
- **Patch (0-bosqich qaroriga ko'ra):** `leaderboard_entries` + yozuvi + `storage.getLeaderboard`/
  `updateLeaderboardEntry` olib tashlandi. `prize_winners`, `notifications`, `ipAddress`,
  `agreedAt` o'chirildi. CSV `username`→`email`. **Saqlandi:** `competition_participants`,
  `battle_participants.isWinner` (3/4-bosqich ularga yozadi).
- Commit: `1d6d8c6`.

### ⚠️ Bug 6 — O'lik kod va tartibsizlik
- `render.yaml` o'chirilgan `admin_bot/` Python worker'ni deploy qilishga urinardi (build xato).
- Orphan fayllar (import yo'q): `server/telegram.ts`, `script/migrate.ts`,
  `client/src/lib/auth-utils.ts`, `client/src/hooks/use-mobile.tsx`.
- Orphan endpointlar (client chaqirmaydi): `GET /api/results/me`, `GET /api/battles/:code`
  (auth'siz info-leak), `POST /api/auth/telegram` (mini-app o'chirilgan). **Saqlandi:**
  `GET /api/admin/bot-stats` (tashqi Python bot ishlatishi mumkin).
- ~15 ishlatilmagan import + 2 o'lik type interfeys.
- **Patch:** yuqoridagilarning barchasi olib tashlandi.
- Commit: `b00c09f`.

---

## 3. Follow-up ishlar (audit keyingi tekshiruvdan)

### 3.1 Socket join access-code pariteti (🔴)
- Muammo: `join-room`ga ban+gender qo'shilgan edi, lekin **access-code** tasdiqlanmagan —
  kod'siz hujumchi real xona kodi bilan socket orqali private xonaga kira olardi.
- Kuzatuv: REST join har qanday qo'shilishni access/creation-code orqali o'tkazadi va faqat
  shunda `battle_participants` qatori yaratadi (real kod bilan to'g'ridan join `routes.ts`da bloklangan).
- **Patch:** `handleJoinRoom`da non-admin foydalanuvchi **allaqachon `battle_participants`
  qatoriga ega bo'lishi** shart (ya'ni REST join'dan o'tgan), aks holda rad. Xona egasi istisno.
  Fail-closed. Eski `ensureParticipant` metodi shu blok bilan qamrab olindi.
- Commit: `6124d29`.

### 3.2 Reviews va reklama tizimini butunlay o'chirish (foydalanuvchi qarori)
- **Reviews:** jadval, `insertReviewSchema`, `createReview`, `GET/POST /api/reviews`,
  client query/mutation/state olib tashlandi (UI hech qachon bo'lmagan).
- **Reklama (butun tizim):** `advertisements` jadvali+typelar, storage metodlari,
  `GET /api/advertisements` + barcha `/api/admin/ads*`, `banner.tsx`, `admin.tsx`, `/admin`
  route, landing banner, test'dagi ads case.
- Commit: `4d6b6d0`.

### 3.3 Leaderboard ajratish (battle vs solo) — Yondashuv A
- Muammo: battle natijalari `test_results`ga yozilib solo bilan aralashardi.
- **Patch:** `test_results.source` ustuni (`'solo'|'battle'`, default `'solo'`, indeks bilan).
  `LeaderboardService` faqat `source='solo'`ni hisoblaydi. `finishBattle` `source='battle'`
  yozadi. Solo `POST /api/results` server tomonda `source='solo'`ni majburlaydi (spoofing yo'q).
- Eslatma: profil statistikasi (`getUserStats`) battle+solo aralash qoldi (shaxsiy ma'lumot);
  faqat public leaderboard solo-only.
- Commit: `e8792cf`.

---

## 4. 0-bosqich arxitektura qarorlari (foydalanuvchi tasdiqlagan)

- **Leaderboard source of truth = `test_results`** (leaderboard_entries olib tashlandi).
- **O'chirildi:** `prize_winners`, `notifications`, `battle_participants.ipAddress`, `agreedAt`,
  keyinchalik `reviews` va butun `advertisements`.
- **Saqlandi:** `competition_participants`, `battle_participants.isWinner`.
- **DB TLS:** CA-optional (buzmaydigan) yechim. **Rasm-tozalash bloki:** olib tashlandi.
- **Reklama `clicks`/`description` ustunlari:** avval qo'shilgan, keyin foydalanuvchi veto qilib qaytarildi.

---

## 5. Commit tarixi (audit)

| Commit | Bosqich/Ish |
|---|---|
| `d9595c3` | 1: logs untrack, .env.example, admin sirlar |
| `06b8945` | 1: to'liq server implementatsiyalarini tiklash |
| `4be9dd9` | 2: log/response sızması, TRUNCATE olib tashlash |
| `2870bb2` | 2: DB TLS (CA-optional), rasm-tozalash olib tashlash |
| `58e09e7` | 3: 9 phantom endpoint |
| `f2565e8` | 3: ads clicks/description ustunlari revert |
| `1e06acd` | 4: real-time socket oqimi (7 tuzatish) |
| `1d6d8c6` | 5: schema tozalash (o'lik jadval/ustunlar) |
| `b00c09f` | 6: o'lik kod (orphan fayl/endpoint/import) |
| `6124d29` | Follow-up 1: socket access-code pariteti |
| `4d6b6d0` | Follow-up 2: reviews + reklama tizimini o'chirish |
| `e8792cf` | Follow-up 3: leaderboard battle/solo ajratish |

---

## 6. Ochiq qolgan / deploy eslatmalari

- ⚠️ **DB backup majburiy:** `drizzle-kit push` (deploy'da) `leaderboard_entries`,
  `prize_winners`, `notifications`, `reviews`, `advertisements` jadvallarini va
  `ipAddress`/`agreedAt` ustunlarini **DROP qiladi**. `test_results.source` esa additive.
- ⚠️ **DB ulanishi:** TLS o'zgarishi buzmaydigan (CA berilmasa hozirgidek). Qat'iy TLS uchun
  `DB_CA_CERT` env qo'shing.
- ⚠️ **Jonli test:** deploydan keyin sinash kerak — check-username (band nom rad), musobaqa
  register/participants, socket join (kodli xona kod'siz rad / kod bilan qabul), battle join →
  natija saqlanishi → leaderboard yangilanishi (solo-only).
- Server/ops ishlari (backup, `DB_CA_CERT`, deploy, smoke-test) — repo egasi tomonidan bajariladi.
