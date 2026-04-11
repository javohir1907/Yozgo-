import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  boolean,
  varchar,
  unique,
  jsonb,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index("test_user_id_idx").on(table.userId),
    languageIdx: index("test_language_idx").on(table.language),
    wpmIdx: index("test_wpm_idx").on(table.wpm),
  };
});

export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  wpm: integer("wpm").notNull(),
  accuracy: integer("accuracy").notNull(),
  language: text("language").notNull(),
  period: text("period").notNull(), // 'daily', 'weekly', 'alltime'
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  ipAddress: varchar("ip_address"),
  agreedAt: timestamp("agreed_at"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const advertisements = pgTable("advertisements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  durationDays: integer("duration_days").default(7),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prizeWinners = pgTable("prize_winners", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  competitionId: integer("competition_id")
    .references(() => competitions.id)
    .notNull(),
  prizeGivenAt: timestamp("prize_given_at").defaultNow().notNull(),
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

export const insertTestResultSchema = createInsertSchema(testResults).omit({
  id: true,
  createdAt: true,
});

export const insertLeaderboardEntrySchema = createInsertSchema(leaderboardEntries).omit({
  id: true,
  updatedAt: true,
});

export const insertBattleSchema = createInsertSchema(battles).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertCompetitionSchema = createInsertSchema(competitions).omit({
  id: true,
  createdAt: true,
});
export const insertAdvertisementSchema = createInsertSchema(advertisements).omit({ id: true });

export const insertBattleParticipantSchema = createInsertSchema(battleParticipants).omit({
  id: true,
  joinedAt: true,
});

export type TestResult = typeof testResults.$inferSelect;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;

export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;

export type Battle = typeof battles.$inferSelect;
export type InsertBattle = z.infer<typeof insertBattleSchema>;

export type BattleParticipant = typeof battleParticipants.$inferSelect;
export type InsertBattleParticipant = z.infer<typeof insertBattleParticipantSchema>;

export type User = typeof users.$inferSelect;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Competition = typeof competitions.$inferSelect;
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;

export type Advertisement = typeof advertisements.$inferSelect;
export type InsertAdvertisement = z.infer<typeof insertAdvertisementSchema>;

export type PrizeWinner = typeof prizeWinners.$inferSelect;
export type RoomAccessCode = typeof roomAccessCodes.$inferSelect;
export type BotState = typeof botStates.$inferSelect;

export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: text("value").notNull(),
});
