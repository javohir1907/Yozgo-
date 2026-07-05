/**
 * YOZGO Gamifikatsiya — Coin formulasi (Feature 8), isomorphic (sof TS).
 *
 * XP bilan bir xil gating (anti-cheat/95% floor), lekin kichikroq qiymatlar.
 * Coin SERVER tomonda hisoblanadi; client hech qachon yubormaydi.
 */
export interface CoinInput {
  wpm: number;
  accuracy: number;
}

export const MAX_WPM = 260;
export const ACCURACY_FLOOR = 95;
export const WINNER_COIN_BONUS = 3;

function baseCoins(wpm: number, accuracy: number): number {
  if (!Number.isFinite(wpm) || !Number.isFinite(accuracy)) return 0;
  if (wpm <= 0 || wpm > MAX_WPM) return 0;
  const acc = Math.max(0, Math.min(100, accuracy));
  const base = Math.round((wpm / 10) * Math.pow(acc / 100, 2));
  if (acc < ACCURACY_FLOOR) return Math.round(base * 0.5);
  return base + 1;
}

export function computeSoloCoins({ wpm, accuracy }: CoinInput): number {
  return baseCoins(wpm, accuracy);
}

export function computeBattleCoins({
  wpm,
  accuracy,
  isWinner,
}: CoinInput & { isWinner: boolean }): number {
  const base = baseCoins(wpm, accuracy);
  if (base <= 0) return 0;
  return isWinner ? base + WINNER_COIN_BONUS : base;
}
