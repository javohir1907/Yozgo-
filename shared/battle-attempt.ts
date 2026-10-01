export interface BattleAttemptData {
  index: number;
  words: string[];
  startTime: number;
  endTime: number;
  serverNow: number;
}

export type BattleAttemptResponse =
  | { attempt: BattleAttemptData; error?: never }
  | { error: string; attempt?: never };

export type BattleWordsResponse =
  | { index: number; offset: number; words: string[]; error?: never }
  | { error: string; index?: never; offset?: never; words?: never };
