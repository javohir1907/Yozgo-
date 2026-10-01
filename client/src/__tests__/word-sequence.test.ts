import { createWordSequence, words } from "@shared/words";

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

});
