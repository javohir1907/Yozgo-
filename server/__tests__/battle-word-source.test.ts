import { words } from "../../shared/words";
import { BattleWordSource } from "../utils/battle-word-source";

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = Math.imul(state, 1_664_525) + 1_013_904_223;
    return (state >>> 0) / 4_294_967_296;
  };
}

describe("BattleWordSource", () => {
  it("keeps generating distinct rounds through round 1000", () => {
    const source = new BattleWordSource("en", seededRandom(17));
    const orders = new Set<string>();

    for (let roundIndex = 0; roundIndex < 1_000; roundIndex += 1) {
      const round = source.getWords(roundIndex, 0, 600);
      expect(round).toHaveLength(600);
      expect(orders.has(round.join(" "))).toBe(false);
      orders.add(round.join(" "));
    }
    expect(orders.size).toBe(1_000);
  });

  it("appends beyond 6000 words in one round without changing earlier text", () => {
    const source = new BattleWordSource("kaa", seededRandom(29));
    const initial = source.getWords(0, 0, 600);
    const sequence = [...initial];
    for (let offset = 600; offset < 9_600; offset += 600) {
      sequence.push(...source.getWords(0, offset, 600));
    }

    expect(sequence).toHaveLength(9_600);
    expect(source.getWords(0, 0, 600)).toEqual(initial);
    expect(source.getWords(0, 0, 9_600)).toEqual(sequence);
    for (let index = 1; index < sequence.length; index += 1) {
      expect(sequence[index]).not.toBe(sequence[index - 1]);
    }
  });

  it("gives matching text to participants regardless of request order", () => {
    const source = new BattleWordSource("uz", seededRandom(41));
    const latePage = source.getWords(27, 1_200, 600);
    const firstPage = source.getWords(27, 0, 600);
    source.getWords(100, 0, 600);

    expect(source.getWords(27, 1_200, 600)).toEqual(latePage);
    expect(source.getWords(27, 0, 600)).toEqual(firstPage);
    const modifiedCopy = source.getWords(27, 0, 600);
    modifiedCopy[0] = "changed";
    expect(source.getWords(27, 0, 600)).toEqual(firstPage);
  });

  it("rejects repeated complete orders even when the RNG always repeats", () => {
    const source = new BattleWordSource("en", () => 0);
    const vocabulary = [...new Set(words.en)];
    const sortedVocabulary = [...vocabulary].sort();
    const orders = new Set<string>();

    for (let roundIndex = 0; roundIndex < 1_000; roundIndex += 1) {
      const round = source.getWords(roundIndex, 0, vocabulary.length * 2);
      for (let offset = 0; offset < round.length; offset += vocabulary.length) {
        const cycle = round.slice(offset, offset + vocabulary.length);
        expect([...cycle].sort()).toEqual(sortedVocabulary);
        expect(orders.has(cycle.join(" "))).toBe(false);
        orders.add(cycle.join(" "));
      }
      expect(round[vocabulary.length]).not.toBe(round[vocabulary.length - 1]);
    }
    expect(orders.size).toBe(2_000);
  });

  it.each(["unknown", "constructor", "__proto__"])("falls back to English for %s", (language) => {
    const source = new BattleWordSource(language, () => 0.5);
    const cycle = source.getWords(0, 0, new Set(words.en).size);
    expect(new Set(cycle)).toEqual(new Set(words.en));
  });

  it("rejects invalid coordinates and random values instead of producing empty words", () => {
    const source = new BattleWordSource("en");
    expect(() => source.getWords(-1, 0, 600)).toThrow(RangeError);
    expect(() => source.getWords(0, 0.5, 600)).toThrow(RangeError);
    expect(() => source.getWords(0, 0, -600)).toThrow(RangeError);
    expect(() => source.getWords(0, Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
    expect(source.getWords(0, 0, 0)).toEqual([]);
    expect(() => new BattleWordSource("en", () => 1).getWords(0, 0, 600)).toThrow(RangeError);
  });
});
