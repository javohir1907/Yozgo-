import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  boolean,
  varchar,
  jsonb,
  index,
  uniqueIndex,
  serial,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "./models/auth";

export { users, sessions } from "./models/auth";

export const testResults = pgTable("test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id),
  wpm: integer("wpm").notNull(),
  accuracy: integer("accuracy").notNull(),
  language: text("language").notNull(), // 'en', 'ru', 'uz'
  mode: text("mode").notNull(), // '15', '30', '60'
  source: text("source").notNull().default("solo"), // 'solo' | 'battle' — leaderboard ajratish uchun
  // Gamifikatsiya audit ustuni (Feature 1). SERVER tomonda hisoblanadi.
  // Battle ko'zgu (mirror) yozuvida ATAYLAB 0 — battle XP battle_participants'da
  // hisoblanadi, aks holda SUM(test_results.xp_awarded) audit ikki marta sanaydi.
  xpAwarded: integer("xp_awarded").notNull().default(0),
  // Feature 8 — per-natija coin audit (battle mirror'da 0).
  coinsAwarded: integer("coins_awarded").notNull().default(0),
  // Request-idempotency (nullable): client har test uchun BIR martalik UUID yuboradi.
  // NULL bo'lsa idempotency yo'q (legacy client). (user_id, client_result_id) unikal —
  // NULL'lar Postgres'da distinct, shuning uchun eski rowlar/idsiz so'rovlar to'qnashmaydi.
  clientResultId: uuid("client_result_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("test_user_id_idx").on(table.userId),
    languageIdx: index("test_language_idx").on(table.language),
    wpmIdx: index("test_wpm_idx").on(table.wpm),
    sourceIdx: index("test_source_idx").on(table.source),
    clientResultUniq: uniqueIndex("test_results_user_client_uniq").on(table.userId, table.clientResultId),
  };
});

// NOTE: `leaderboard_entries` jadvali olib tashlandi (0-bosqich qarori) — global
// leaderboard yagona manba sifatida `test_results`dan hisoblanadi (LeaderboardService).

export const battles = pgTable("battles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  status: text("status").notNull(), // 'waiting', 'playing', 'finished'
  language: text("language").notNull(),
  mode: text("mode").notNull(),
  creatorId: varchar("creator_id").references(() => users.id),
  maxParticipants: integer("max_participants").default(10), // Default bepul limit
  genderRestriction: text("gender_restriction").default("all"), // all, male, female
  isOfficial: boolean("is_official").default(false), // Adminlar uchun (xolmatovlar)
  roomPrice: integer("room_price").default(0), // Xona uchun to'lov summasi
  accessCode: text("access_code"), // Admin bergan maxsus pre-authorized kod
  duration: integer("duration").default(60), // Test davomiyligi (soniya)
  competitionLength: integer("competition_length").default(10), // Musobaqa davomiyligi (daqiqa)
  role: text("creator_role").default("participant"), // creator as spectator or participant
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const battleParticipants = pgTable("battle_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  battleId: uuid("battle_id")
    .references(() => battles.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  wpm: integer("wpm"),
  accuracy: integer("accuracy"),
  isWinner: boolean("is_winner").default(false),
  // Gamifikatsiya — battle XP shu yerda hisoblanadi (Feature 1).
  xpAwarded: integer("xp_awarded").notNull().default(0),
  // Feature 8 — battle coin shu yerda.
  coinsAwarded: integer("coins_awarded").notNull().default(0),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const competitions = pgTable("competitions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  reward: text("reward"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const competitionParticipants = pgTable("competition_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: integer("competition_id")
    .references(() => competitions.id)
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
});

export const roomAccessCodes = pgTable(
  "room_access_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .references(() => battles.id)
      .notNull(), // using battles.id
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    code: varchar("code").notNull().unique(),
    isUsed: boolean("is_used").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    usedAt: timestamp("used_at"),
  }
);

export const adminMessages = pgTable("admin_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromAdmin: boolean("from_admin").default(true).notNull(),
  toUserId: varchar("to_user_id")
    .references(() => users.id)
    .notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const competitionCreationCodes = pgTable("competition_creation_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code").notNull().unique(), // Admin beradigan kod (masalan: YOZGO-9V2K)
  maxParticipants: integer("max_participants").notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  createdBy: text("created_by").notNull(), // Uni yaratgan admin Telegram ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // 5 kunlik muddat uchun
  activeBattleId: uuid("active_battle_id").references(() => battles.id), // Hozirgi ochiq xona
  usedByUserId: varchar("used_by_user_id").references(() => users.id),
  usedAt: timestamp("used_at"),
});

export const botStates = pgTable("bot_states", {
  telegramId: text("telegram_id").primaryKey(),
  stateData: jsonb("state_data").notNull().default({}),
  lastActivity: timestamp("last_activity").defaultNow(),
});

export const insertTestResultSchema = createInsertSchema(testResults, {
  // XAVFSIZLIK/robustlik: mode faqat '15'|'30'|'60' bo'lishi mumkin. U bir necha
  // joyda `cast(mode as integer)` qilinadi (leaderboard totalSeconds, quest words) —
  // client 'custom' yuborsa butun agregat query Postgres xatosi bilan yiqiladi.
  mode: z.enum(["15", "30", "60"]),
  // Idempotency kaliti: client yuboradi (ixtiyoriy), lekin yaroqli UUID bo'lsin.
  clientResultId: z.string().uuid().nullish(),
}).omit({
  id: true,
  createdAt: true,
  // Gamifikatsiya: xp_awarded/coins_awarded'ni client HECH QACHON yubora olmasin
  // (server hisoblaydi — audit ustunlari spoofdan himoyalanadi).
  xpAwarded: true,
  coinsAwarded: true,
});

export const insertBattleSchema = createInsertSchema(battles).omit({
  id: true,
  createdAt: true,
});

export const insertCompetitionSchema = createInsertSchema(competitions).omit({
  id: true,
  createdAt: true,
});

export const insertBattleParticipantSchema = createInsertSchema(battleParticipants).omit({
  id: true,
  joinedAt: true,
});

export type TestResult = typeof testResults.$inferSelect;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;

export type Battle = typeof battles.$inferSelect;
export type InsertBattle = z.infer<typeof insertBattleSchema>;

export type BattleParticipant = typeof battleParticipants.$inferSelect;
export type InsertBattleParticipant = z.infer<typeof insertBattleParticipantSchema>;

export type User = typeof users.$inferSelect;

export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;

export type RoomAccessCode = typeof roomAccessCodes.$inferSelect;
export type BotState = typeof botStates.$inferSelect;

// ============ GAMIFIKATSIYA — BADGE / ACHIEVEMENT (Feature 3) ============
// Katalog: faqat `key`+`icon`+tartib saqlanadi. Title/description client'da
// `key` bo'yicha lokalizatsiya qilinadi (bitta row 4 tilga xizmat qiladi).
export const badges = pgTable("badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  icon: text("icon").notNull(), // lucide ikonka nomi
  sortOrder: integer("sort_order").notNull().default(0),
});

// user_badges: kim qaysi badge'ni qachon ochgani. UNIQUE(userId,badgeId) —
// bir badge ikki marta berilmasin (idempotentlik kafolati; ON CONFLICT target).
export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    badgeId: uuid("badge_id")
      .references(() => badges.id)
      .notNull(),
    earnedAt: timestamp("earned_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      userBadgeUnique: uniqueIndex("user_badge_unique").on(table.userId, table.badgeId),
      userBadgesUserIdx: index("user_badges_user_idx").on(table.userId),
    };
  },
);

export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;

// ============ GAMIFIKATSIYA — LIGALAR (Feature 5) ============
// Divizionlar config-jadvali (tier 0..5). Nomlar data-driven (badge-defs uslubi).
export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  tier: integer("tier").notNull().unique(), // 0=Bronza .. 5=Afsona
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Har foydalanuvchining jonli a'zoligi (bitta row). weekly_xp = SHU haftalik XP
// (jami users.xp EMAS) — Contract A. Cohort = ~30 kishilik guruh.
export const leagueMembers = pgTable(
  "league_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),
    leagueTier: integer("league_tier").notNull().default(0),
    cohortId: uuid("cohort_id"),
    weeklyXp: integer("weekly_xp").notNull().default(0),
    weekStart: date("week_start"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => {
    return {
      cohortIdx: index("league_members_cohort_idx").on(t.cohortId, t.weeklyXp),
      tierIdx: index("league_members_tier_idx").on(t.leagueTier),
    };
  },
);

// Haftalik reset auditi (promote/relegate tarixi) — "o'tgan hafta ko'tarilding" UX.
export const leagueHistory = pgTable(
  "league_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    weekStart: date("week_start").notNull(),
    leagueTier: integer("league_tier").notNull(),
    finalRank: integer("final_rank").notNull(),
    weeklyXp: integer("weekly_xp").notNull(),
    outcome: text("outcome").notNull(), // 'promote' | 'stay' | 'relegate'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => {
    return { userIdx: index("league_history_user_idx").on(t.userId, t.weekStart) };
  },
);

// Haftalik reset single-fire guard (multi-instance/qayta ishga tushishda dublikat
// promote bo'lmasin) — thisMonday PK, INSERT konflikti = allaqachon bajarilgan.
export const leagueResetLog = pgTable("league_reset_log", {
  weekStart: date("week_start").primaryKey(),
  runAt: timestamp("run_at").defaultNow().notNull(),
});

export type League = typeof leagues.$inferSelect;
export type LeagueMember = typeof leagueMembers.$inferSelect;
export type LeagueHistory = typeof leagueHistory.$inferSelect;

// ============ GAMIFIKATSIYA — KUNLIK QUEST (Feature 6) ============
// Faqat foydalanuvchi progressi saqlanadi (definitsiyalar config-in-code).
// UNIQUE(user_id,quest_key,quest_date) — idempotent upsert conflict target.
export const dailyQuestProgress = pgTable(
  "daily_quest_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    questKey: text("quest_key").notNull(),
    questDate: date("quest_date").notNull(), // Asia/Tashkent kun
    progress: integer("progress").notNull().default(0),
    target: integer("target").notNull(), // def target snapshot (keyin tuning in-flight'ni buzmasin)
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at"),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => {
    return {
      uq: uniqueIndex("daily_quest_user_key_date").on(t.userId, t.questKey, t.questDate),
      userDateIdx: index("daily_quest_user_date_idx").on(t.userId, t.questDate),
    };
  },
);

export type DailyQuestProgress = typeof dailyQuestProgress.$inferSelect;

// ============ GAMIFIKATSIYA — COIN + KOSMETIKA (Feature 8) ============
// Katalog config-jadval (badge/liga uslubi). type: 'theme' | 'frame' | 'streak_freeze'.
export const cosmetics = pgTable("cosmetics", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  type: text("type").notNull(),
  price: integer("price").notNull(),
  meta: jsonb("meta").notNull().default({}), // theme accent HSL / frame ring class
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// Egalik. UNIQUE(user_id,cosmetic_id) — ikki marta sotib olinmasin (ON CONFLICT guard).
export const userCosmetics = pgTable(
  "user_cosmetics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    cosmeticId: uuid("cosmetic_id")
      .references(() => cosmetics.id)
      .notNull(),
    acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  },
  (t) => {
    return { uq: uniqueIndex("user_cosmetic_unique").on(t.userId, t.cosmeticId) };
  },
);

export type Cosmetic = typeof cosmetics.$inferSelect;
export type UserCosmetic = typeof userCosmetics.$inferSelect;

// ============ GAMIFIKATSIYA — DO'STLAR (Feature 9) ============
// Kanonik BITTA row per juftlik. LEAST/GREATEST expression unique index {A,B} va
// {B,A}ni to'qnashtiradi — teskari dublikat DB darajasida imkonsiz.
export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: varchar("requester_id")
      .references(() => users.id)
      .notNull(),
    addresseeId: varchar("addressee_id")
      .references(() => users.id)
      .notNull(),
    status: text("status").notNull().default("pending"), // 'pending' | 'accepted'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => {
    return {
      pairUniq: uniqueIndex("friendships_pair_uniq").on(
        sql`LEAST(${t.requesterId}, ${t.addresseeId})`,
        sql`GREATEST(${t.requesterId}, ${t.addresseeId})`,
      ),
      reqIdx: index("friendship_requester_idx").on(t.requesterId),
      addrIdx: index("friendship_addressee_idx").on(t.addresseeId),
      statusIdx: index("friendship_status_idx").on(t.status),
    };
  },
);

export type Friendship = typeof friendships.$inferSelect;

export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: text("value").notNull(),
});
