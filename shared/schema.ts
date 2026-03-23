import {
  pgTable,
  text,
  timestamp,
  integer,
  uuid,
  boolean,
  varchar,
  unique,
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
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  prize: text("prize"),
  date: timestamp("date").notNull(),
  participantsCount: integer("participants_count").default(0),
  winnerName: text("winner_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const competitionParticipants = pgTable("competition_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  competitionId: uuid("competition_id")
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
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  clicks: integer("clicks").default(0),
});

export const prizeWinners = pgTable("prize_winners", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  competitionId: uuid("competition_id")
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
  },
  (t) => ({
    unqRoomUser: unique("room_user_unique").on(t.roomId, t.userId),
  })
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
export type AdminMessage = typeof adminMessages.$inferSelect;
