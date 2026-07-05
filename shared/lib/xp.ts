/**
 * YOZGO Gamifikatsiya — XP & Level yagona manba (isomorphic).
 *
 * Bu fayl SOF TypeScript — hech qanday server-only import (db/pool) yo'q, shuning
 * uchun uni ham server (XP berish), ham client (profil progress-bar) import qiladi.
 * XP HAR DOIM server tomonda hisoblanadi; client bu funksiyalarni faqat ko'rsatish
 * uchun ishlatadi.
 *
 * Formula: saqlangan `wpm` allaqachon NET WPM (client correctChars/5/min hisoblaydi).
 *   base = round(netWpm * (accuracy/100)^2)   — accuracy kvadrat: sidirg'a yozishni jazolaydi
 *   accuracy < 95  -> round(base * 0.5)        — 95% floor: to'liq XP berilmaydi
 *   accuracy >= 95 -> base + 10                — aniqlik bonusi
 *   battle g'olibi  -> + WINNER_BONUS           — bir marta
 *   wpm > 260 yoki wpm <= 0 -> 0                — anti-cheat (defensiv)
 *
 * Level egri chizig'i: har level ~1.5x oldingisidan qimmat (L1->2 = 100 XP).
 */

export const MAX_WPM = 260;
export const ACCURACY_FLOOR = 95;
export const ACCURACY_BONUS = 10;
export const WINNER_BONUS = 25;

export interface XpInput {
  wpm: number;
  accuracy: number;
}

/** Sof XP formulasi (base + 95% floor/bonus). Anti-cheat gate ichida. */
function baseXp(wpm: number, accuracy: number): number {
  if (!Number.isFinite(wpm) || !Number.isFinite(accuracy)) return 0;
  if (wpm <= 0 || wpm > MAX_WPM) return 0; // anti-cheat hard floor
  const acc = Math.max(0, Math.min(100, accuracy));
  const base = Math.round(wpm * Math.pow(acc / 100, 2));
  if (acc < ACCURACY_FLOOR) return Math.round(base * 0.5);
  return base + ACCURACY_BONUS;
}

/** Solo test uchun beriladigan XP. */
export function computeSoloXp({ wpm, accuracy }: XpInput): number {
  return baseXp(wpm, accuracy);
}

/** Battle uchun beriladigan XP (g'olibga qo'shimcha bonus). */
export function computeBattleXp({
  wpm,
  accuracy,
  isWinner,
}: XpInput & { isWinner: boolean }): number {
  const base = baseXp(wpm, accuracy);
  if (base <= 0) return 0; // banned/extreme natija bonus ham olmaydi
  return isWinner ? base + WINNER_BONUS : base;
}

// ============ LEVEL EGRI CHIZIG'I ============

const LEVEL_BASE = 100; // L1 -> L2 narxi
const LEVEL_GROWTH = 1.5; // har level oldingisidan 1.5x qimmat
export const MAX_LEVEL = 200; // runaway loop backstop

/**
 * `level`ga YETISH uchun kerakli kümülativ XP.
 * xpForLevel(1)=0, (2)=100, (3)=250, (4)=475, ...
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const L = Math.min(level, MAX_LEVEL);
  return Math.round((LEVEL_BASE * (Math.pow(LEVEL_GROWTH, L - 1) - 1)) / (LEVEL_GROWTH - 1));
}

/** Berilgan XP uchun level (xpForLevel(L) <= xp bo'lgan eng katta L). */
export function levelForXp(xp: number): number {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= safeXp) {
    level++;
  }
  return level;
}

export interface XpProgress {
  level: number;
  xp: number;
  xpIntoLevel: number; // joriy level ichida to'plangan XP
  xpForNextLevel: number; // joriy leveldan keyingisiga o'tish uchun kerak (delta)
  pct: number; // 0..100 progress-bar uchun
}

/** UI progress-bar uchun to'liq holat. */
export function xpProgress(xp: number): XpProgress {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  const level = levelForXp(safeXp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const xpIntoLevel = safeXp - floor;
  return {
    level,
    xp: safeXp,
    xpIntoLevel,
    xpForNextLevel: span,
    pct: Math.max(0, Math.min(100, Math.round((xpIntoLevel / span) * 100))),
  };
}
