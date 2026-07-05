/**
 * YOZGO Gamifikatsiya — Rank / unvon (Feature 7), isomorphic (sof TS).
 *
 * Faqat VIZUAL/status — leaderboard EMAS. Foydalanuvchining eng yaxshi WPM'iga
 * qarab FIXED chegaralar bilan unvon (live percentile EMAS — percentile har so'rovda
 * to'liq taqsimot skanini talab qiladi; fixed thresholds O(1), barqaror, tushunarli).
 * Titlelar client'da `key` bo'yicha lokalizatsiya qilinadi.
 */
export interface RankDef {
  key: string;
  minWpm: number;
}

export const RANK_DEFS: RankDef[] = [
  { key: "beginner", minWpm: 0 }, // Boshlovchi
  { key: "intermediate", minWpm: 40 }, // O'rta
  { key: "advanced", minWpm: 70 }, // Ilg'or
  { key: "pro", minWpm: 100 }, // Pro
  { key: "master", minWpm: 130 }, // Master
];

/** Eng yaxshi WPM uchun unvonni qaytaradi (eng yuqori mos chegarani tanlaydi). */
export function resolveRank(bestWpm: number): RankDef {
  const wpm = Number.isFinite(bestWpm) && bestWpm > 0 ? bestWpm : 0;
  let result = RANK_DEFS[0];
  for (const d of RANK_DEFS) {
    if (wpm >= d.minWpm) result = d;
  }
  return result;
}
