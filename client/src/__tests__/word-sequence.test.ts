import { createBattleWordSequence, createWordSequence, words } from "@shared/words";

describe("createWordSequence", () => {
  it("uses every unique word before it repeats", () => {
    const uniqueKarakalpakWords = new Set(words.kaa);
    const sequence = createWordSequence("kaa", uniqueKarakalpakWords.size, () => 0.5);

    expect(sequence).toHaveLength(uniqueKarakalpakWords.size);
    expect(new Set(sequence)).toEqual(uniqueKarakalpakWords);
    expect(words.kaa).toEqual(expect.arrayContaining(["hám", "oqıw", "kóriw", "erteń"]));
    expect(words.kaa).toEqual(expect.not.arrayContaining(["ham", "o'qıw", "ko'riw", "ertaga"]));
  });

  it("does not repeat a word at a shuffled cycle boundary", () => {
    const sequence = createWordSequence("uz", new Set(words.uz).size * 3, () => 0.5);

    for (let i = 1; i < sequence.length; i += 1) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });

  it("falls back to English for an unknown language", () => {
    expect(createWordSequence("missing-language", 5, () => 0.5)).toHaveLength(5);
  });

  it("gives every battle attempt a different 50-word order", () => {
    const wordsPerRound = 50;
    const rounds = createBattleWordSequence("en", 4, wordsPerRound, () => 0.5);
    const signatures = Array.from({ length: 4 }, (_, index) =>
      rounds.slice(index * wordsPerRound, (index + 1) * wordsPerRound).join("\u0000"),
    );

    expect(rounds).toHaveLength(4 * wordsPerRound);
    expect(new Set(signatures).size).toBe(4);
  });

  it("does not reuse a 50-word block in the same battle", () => {
    const wordsPerRound = 100;
    const sequence = createBattleWordSequence("uz", 3, wordsPerRound, () => 0.5);
    const chunks = Array.from({ length: 6 }, (_, index) =>
      sequence.slice(index * 50, (index + 1) * 50).join("\u0000"),
    );

    expect(new Set(chunks).size).toBe(chunks.length);
  });

  it("keeps all 120 short rounds distinct when the initial random source repeats", () => {
    const wordsPerRound = 50;
    const sequence = createBattleWordSequence("en", 120, wordsPerRound, () => 0.5);
    const openings = Array.from({ length: 120 }, (_, index) =>
      sequence.slice(index * wordsPerRound, (index + 1) * wordsPerRound).join("\u0000"),
    );

    expect(new Set(openings).size).toBe(openings.length);
  });
});
