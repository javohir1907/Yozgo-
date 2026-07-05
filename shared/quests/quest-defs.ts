/**
 * YOZGO Gamifikatsiya — Kunlik quest definitsiyalari (Feature 6), config-in-code.
 *
 * Har Tashkent-kun 3 ta quest (2 solo + 1 battle) DETERMINISTIK tarzda (sanadan)
 * tanlanadi — hamma bir xil kunlik questni ko'radi (social hook). Titlelar client'da
 * `key` bo'yicha lokalizatsiya qilinadi.
 */
export interface QuestDef {
  key: string;
  icon: string; // lucide nomi
  xpReward: number;
  metric: "words" | "tests" | "testsAtAccuracy" | "battleWins" | "battlePlays";
  target: number;
  accuracyGate?: number;
}

// Har event: solo natija yoki tugagan battle. Progress increment shu ikki nuqtadan.
export type QuestEvent =
  | { type: "solo"; wpm: number; accuracy: number; mode: string }
  | { type: "battle"; wpm: number; accuracy: number; isWinner: boolean };

const SOLO_QUESTS: QuestDef[] = [
  { key: "words_500", icon: "Type", xpReward: 50, metric: "words", target: 500 },
  { key: "words_1000", icon: "Type", xpReward: 100, metric: "words", target: 1000 },
  { key: "accuracy_3", icon: "Target", xpReward: 60, metric: "testsAtAccuracy", target: 3, accuracyGate: 95 },
  { key: "tests_5", icon: "Repeat", xpReward: 40, metric: "tests", target: 5 },
];

const BATTLE_QUESTS: QuestDef[] = [
  { key: "battle_win_1", icon: "Swords", xpReward: 70, metric: "battleWins", target: 1 },
  { key: "battle_play_2", icon: "Users", xpReward: 40, metric: "battlePlays", target: 2 },
];

export const QUEST_DEFINITIONS: QuestDef[] = [...SOLO_QUESTS, ...BATTLE_QUESTS];

// FNV-1a — 'YYYY-MM-DD' -> barqaror seed.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Berilgan Tashkent-kun uchun 3 ta quest (2 solo + 1 battle), deterministik.
 * Bir sanada har doim bir xil to'plam; boshqa sanada boshqacha.
 */
export function pickDailyQuests(dateStr: string): QuestDef[] {
  const seed = hashStr(dateStr);
  const battle = BATTLE_QUESTS[seed % BATTLE_QUESTS.length];
  const i1 = seed % SOLO_QUESTS.length;
  let i2 = (Math.floor(seed / 7) + 1) % SOLO_QUESTS.length;
  if (i2 === i1) i2 = (i1 + 1) % SOLO_QUESTS.length;
  return [SOLO_QUESTS[i1], SOLO_QUESTS[i2], battle];
}

/** Event shu questga qancha birlik qo'shishini qaytaradi. Sof funksiya. */
export function questProgressDelta(def: QuestDef, event: QuestEvent): number {
  switch (def.metric) {
    case "words":
      // Faqat solo (battle event'da mode yo'q). words ~ wpm * soniya / 60.
      return event.type === "solo" ? Math.round((event.wpm * Number(event.mode)) / 60) : 0;
    case "tests":
      return 1; // har tugagan solo/battle = 1
    case "testsAtAccuracy":
      return event.accuracy >= (def.accuracyGate ?? 95) ? 1 : 0;
    case "battleWins":
      return event.type === "battle" && event.isWinner ? 1 : 0;
    case "battlePlays":
      return event.type === "battle" ? 1 : 0;
    default:
      return 0;
  }
}
