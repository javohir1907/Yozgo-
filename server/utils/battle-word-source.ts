import { words } from "../../shared/words";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function nextPermutation(order: number[]): void {
  let pivot = order.length - 2;
  while (pivot >= 0 && order[pivot] > order[pivot + 1]) pivot -= 1;
  if (pivot < 0) {
    order.reverse();
    return;
  }

  let successor = order.length - 1;
  while (order[successor] < order[pivot]) successor -= 1;
  [order[pivot], order[successor]] = [order[successor], order[pivot]];
  for (let left = pivot + 1, right = order.length - 1; left < right; left += 1, right -= 1) {
    [order[left], order[right]] = [order[right], order[left]];
  }
}

/** A room-owned, append-only source shared by everyone on the same round. */
export class BattleWordSource {
  private readonly vocabulary: string[];
  private readonly rounds = new Map<number, string[]>();
  private readonly usedOrders = new Set<string>();
  private fallbackSeed = 0;

  constructor(language: string, private readonly random: () => number = Math.random) {
    const selected = Object.prototype.hasOwnProperty.call(words, language)
      ? words[language as keyof typeof words]
      : words.en;
    this.vocabulary = [...new Set(selected)];
    if (this.vocabulary.length < 2) {
      throw new Error("A battle needs at least two distinct words.");
    }
  }

  getWords(roundIndex: number, offset: number, count: number): string[] {
    for (const value of [roundIndex, offset, count, offset + count]) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError("Round, offset, and count must be non-negative safe integers.");
      }
    }
    if (count === 0) return [];

    let round = this.rounds.get(roundIndex);
    if (!round) {
      round = [];
      this.rounds.set(roundIndex, round);
    }

    while (round.length < offset + count) {
      round.push(...this.createCycle(round[round.length - 1]));
    }
    return round.slice(offset, offset + count);
  }

  private shuffle(random: () => number): number[] {
    const order = this.vocabulary.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError("The random source must return a number from 0 up to 1.");
      }
      const swapIndex = Math.floor(value * (index + 1));
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }
    return order;
  }

  private createCycle(previous: string | undefined): string[] {
    let order = this.shuffle(this.random);
    if (this.vocabulary[order[0]] === previous) {
      [order[0], order[1]] = [order[1], order[0]];
    }

    if (this.usedOrders.has(order.join(","))) {
      // A repeating RNG must still produce varied orders. Seed a fresh shuffle,
      // then enumerate remaining permutations if even that order collides.
      this.fallbackSeed += 1;
      order = this.shuffle(seededRandom(this.fallbackSeed));
      if (this.vocabulary[order[0]] === previous) {
        [order[0], order[1]] = [order[1], order[0]];
      }
      const firstCandidate = order.join(",");
      while (this.usedOrders.has(order.join(",")) || this.vocabulary[order[0]] === previous) {
        if (this.vocabulary[order[0]] === previous) {
          // Skip all permutations with this forbidden first word at once.
          // Walking them individually would traverse an entire factorial block.
          const tail = order.slice(1).sort((left, right) => right - left);
          order = [order[0], ...tail];
        }
        nextPermutation(order);
        if (order.join(",") === firstCandidate) {
          throw new Error("Every available vocabulary order has already been used.");
        }
      }
    }

    this.usedOrders.add(order.join(","));
    return order.map((index) => this.vocabulary[index]);
  }
}
