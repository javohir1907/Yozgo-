/**
 * Space handling in the typing test.
 *
 * The rule under test: space advances to the next word ONLY when the current
 * word has been typed out in full. Pressing it early costs one keystroke but
 * must not move the caret on — an early space used to abandon the rest of the
 * word and silently skip content.
 *
 * The word list is random, so every assertion is derived from whatever word the
 * hook actually produced. `word.slice(0, word.length - 1)` is a partial for any
 * length (it is "" for a one-character word, which is still a valid partial).
 */
import { renderHook, act } from "@testing-library/react";
import { useTypingTest } from "@/hooks/use-typing-test";

type Hook = ReturnType<typeof useTypingTest>;

function setup() {
  return renderHook(() =>
    useTypingTest({ language: "en", mode: 15, onComplete: () => {} }),
  );
}

/** Types `value` into the hook as the input element would report it. */
function type(result: { current: Hook }, value: string) {
  act(() => {
    result.current.handleInputChange(value);
  });
}

describe("space handling", () => {
  it("does not advance when the word is only partly typed", () => {
    const { result } = setup();
    const word = result.current.words[0];
    const partial = word.slice(0, word.length - 1);

    type(result, partial);
    type(result, `${partial} `);

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.userInput).toBe(partial);
  });

  it("does not skip words when space is pressed repeatedly on an empty word", () => {
    const { result } = setup();

    type(result, " ");
    type(result, " ");
    type(result, " ");

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.userInput).toBe("");
  });

  it("advances once the word is complete", () => {
    const { result } = setup();
    const word = result.current.words[0];

    type(result, word);
    type(result, `${word} `);

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.userInput).toBe("");
  });

  it("counts an early space as a keystroke, so accuracy reflects it", () => {
    const { result } = setup();
    const word = result.current.words[0];
    const partial = word.slice(0, word.length - 1);

    type(result, partial);
    const before = result.current.stats.incorrectChars;

    type(result, `${partial} `);

    // The space leaves userInput unchanged, so React can skip the re-render and
    // `stats` would still read the previous commit. Type one more (deliberately
    // wrong) character to force a commit before asserting: that is +1 for the
    // space and +1 for this character.
    const nextChar = word[word.length - 1];
    const wrongChar = nextChar === "z" ? "q" : "z";
    type(result, `${partial}${wrongChar}`);

    expect(result.current.stats.incorrectChars).toBe(before + 2);
    expect(result.current.currentIndex).toBe(0);
  });

  it("still advances when the word was typed wrong but in full", () => {
    const { result } = setup();
    const word = result.current.words[0];
    const wrong = "z".repeat(word.length);

    type(result, wrong);
    type(result, `${wrong} `);

    expect(result.current.currentIndex).toBe(1);
  });
});
