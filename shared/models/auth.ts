import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  telegramId: varchar("telegram_id").unique(),
  role: varchar("role").default("user").notNull(), // added role for admin checks
  gender: varchar("gender"), // male, female (mandatory starting from today)
  isBanned: boolean("is_banned").default(false).notNull(),
  lastNicknameChangeAt: timestamp("last_nickname_change_at"),
  // Gamifikatsiya — XP & Level (Feature 1). Barcha qiymatlar SERVER tomonda
  // hisoblanadi; client hech qachon xp/level yubormaydi.
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  // Gamifikatsiya — Kunlik streak (Feature 2). lastActiveDate = Asia/Tashkent
  // kalendar kuni (date tipi TZ-solishtirish xatolarini oldini oladi).
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: date("last_active_date"),
  // Gamifikatsiya — Coin + kosmetika (Feature 8). Soft valyuta (real pul YO'Q).
  coins: integer("coins").notNull().default(0),
  streakFreezes: integer("streak_freezes").notNull().default(0),
  equippedThemeKey: varchar("equipped_theme_key"),
  equippedFrameKey: varchar("equipped_frame_key"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    emailIdx: index("email_idx").on(table.email),
  };
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
