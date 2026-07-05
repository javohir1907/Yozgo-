/**
 * YOZGO Gamifikatsiya — Badge definitsiyalari (Feature 3), config-in-code.
 *
 * Yangi badge qo'shish = shu massivga 1 yozuv + i18n'ga 4 til satri (title/desc).
 * Titlelar bu yerda EMAS — client `key` bo'yicha lokalizatsiya qiladi.
 *
 * `predicate` sof funksiya (BadgeContext ustidan). streak/xp ustunlari hali
 * yo'q bo'lsa `?? 0` bilan defensiv — badge shunchaki qulf holida qoladi.
 */
export interface BadgeContext {
  totalTests: number;
  bestWpm: number;
  streak: number;
  xp: number;
  battleWins: number;
  isBattleWin?: boolean;
  resultAccuracy?: number;
  source?: "solo" | "battle";
}

export interface BadgeDefinition {
  key: string;
  icon: string; // lucide-react ikonka nomi
  sortOrder: number;
  predicate: (c: BadgeContext) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { key: "speed_60", icon: "Rocket", sortOrder: 10, predicate: (c) => c.bestWpm >= 60 },
  { key: "speed_100", icon: "Flame", sortOrder: 20, predicate: (c) => c.bestWpm >= 100 },
  { key: "tests_100", icon: "Repeat", sortOrder: 30, predicate: (c) => c.totalTests >= 100 },
  { key: "streak_7", icon: "CalendarCheck", sortOrder: 40, predicate: (c) => (c.streak ?? 0) >= 7 },
  {
    key: "first_battle_win",
    icon: "Swords",
    sortOrder: 50,
    predicate: (c) => c.isBattleWin === true,
  },
  {
    key: "perfect_accuracy",
    icon: "Target",
    sortOrder: 60,
    predicate: (c) => c.resultAccuracy === 100,
  },
  { key: "xp_10000", icon: "Star", sortOrder: 70, predicate: (c) => (c.xp ?? 0) >= 10000 },
  // Feature 10 — battle mukofot badge'i (10 ta g'alaba).
  { key: "battle_win_10", icon: "Crown", sortOrder: 80, predicate: (c) => (c.battleWins ?? 0) >= 10 },
];
