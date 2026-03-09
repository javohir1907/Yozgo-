import { pgTable, text, timestamp, integer, uuid, boolean, varchar } from "drizzle-orm/pg-core";
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
  userId: varchar("user_id").references(() => users.id).notNull(),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const battleParticipants = pgTable("battle_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  battleId: uuid("battle_id").references(() => battles.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  wpm: integer("wpm"),
  accuracy: integer("accuracy"),
  isWinner: boolean("is_winner").default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertTestResultSchema = createInsertSchema(testResults).omit({ 
  id: true, 
  createdAt: true 
});

export const insertLeaderboardEntrySchema = createInsertSchema(leaderboardEntries).omit({ 
  id: true, 
  updatedAt: true 
});

export const insertBattleSchema = createInsertSchema(battles).omit({ 
  id: true, 
  createdAt: true 
});

export const insertBattleParticipantSchema = createInsertSchema(battleParticipants).omit({ 
  id: true, 
  joinedAt: true 
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
