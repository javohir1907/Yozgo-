import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface TypingAreaProps {
  words: string[];
  userInput: string;
  onInputChange: (value: string) => void;
  onGoBack?: () => void;
  onRestart?: () => void;
  isActive: boolean;
  currentIndex: number;
  history?: string[];
}

type CharState = "pending" | "correct" | "wrong" | "extra" | "missed";

/** Renders one word. All layout-affecting styles are state-invariant; only the
 * data-state attribute changes, and CSS colours from it. */
function renderChars(word: string, typed: string, past: boolean) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < word.length; i++) {
    let state: CharState = "pending";
    if (i < typed.length) state = typed[i] === word[i] ? "correct" : "wrong";
    else if (past) state = "missed";
    out.push(
      <span key={i} data-char data-state={state === "pending" ? undefined : state}>
        {word[i]}
      </span>,
    );
  }
  // Overflow characters typed past the word length.
  for (let i = word.length; i < typed.length; i++) {
    out.push(
      <span key={`x${i}`} data-char data-state="extra">
        {typed[i]}
      </span>,
    );
  }
  return out;
}

// Past and future words never depend on userInput, so they memoise on
// currentIndex/history and re-render once per word boundary — not per keystroke.
const PastWords = React.memo(function PastWords({
  words,
  from,
  to,
  history,
}: {
  words: string[];
  from: number;
  to: number;
  history: string[];
}) {
  const out: React.ReactNode[] = [];
  for (let i = from; i < to; i++) {
    out.push(
      <span key={i} className="whitespace-nowrap" data-word="past" data-testid={`word-${i}`}>
        {renderChars(words[i], history[i] ?? "", true)}
      </span>,
    );
  }
  return <>{out}</>;
});

const FutureWords = React.memo(function FutureWords({
  words,
  from,
  to,
}: {
  words: string[];
  from: number;
  to: number;
}) {
  const out: React.ReactNode[] = [];
  for (let i = from; i < to; i++) {
    out.push(
      <span key={i} className="whitespace-nowrap" data-word="future" data-testid={`word-${i}`}>
        {renderChars(words[i], "", false)}
      </span>,
    );
  }
  return <>{out}</>;
});

export function TypingArea({
  words,
  userInput,
  onInputChange,
  onGoBack,
  onRestart,
  isActive,
  currentIndex,
  history = [],
}: TypingAreaProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  const [offsetY, setOffsetY] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  // Tab arms a restart; Enter confirms it. See handleKeyDown.
  const [restartArmed, setRestartArmed] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const isTouch =
    typeof window !== "undefined" && "ontouchstart" in window;

  // Grows in blocks of 40 so the memo is stable: ~480 nodes instead of the full
  // set, and renderLimit only changes once every 40 words.
  const renderLimit = useMemo(
    () => Math.min(words.length, (Math.floor(currentIndex / 40) + 2) * 40),
    [words.length, currentIndex],
  );

  // Track container width so caret offsets and line height can be recomputed on
  // reflow (a resize changes where words wrap).
  useEffect(() => {
    const el = wordsRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure the active word's character offsets ONCE per word / reflow, not per
  // keystroke — the old code did querySelectorAll + offset reads on every key,
  // forcing a synchronous layout inside every commit.
  // Offsets live in state, not a ref: a ref mutation would not re-run the caret
  // memo, so the caret would lag one word behind on every word boundary.
  const [charOffsets, setCharOffsets] = useState<
    { top: number; left: number; w: number }[]
  >([]);
  const lineHeightRef = useRef(0);

  // Characters typed past the end of the word render additional [data-char]
  // spans. The measurement pass below has to see them, otherwise charOffsets
  // stops at the word's real length, the caret memo clamps to that last index
  // and the caret sits frozen while the user keeps typing. This value only
  // changes while overflowing, so ordinary typing still measures once per word
  // rather than once per keystroke.
  const overflowCount = Math.max(
    0,
    userInput.length - (words[currentIndex]?.length ?? 0),
  );

  useLayoutEffect(() => {
    const el = activeWordRef.current;
    if (!el) return;
    setCharOffsets(
      Array.from(el.querySelectorAll<HTMLElement>("[data-char]")).map((c) => ({
        top: c.offsetTop,
        left: c.offsetLeft,
        w: c.offsetWidth,
      })),
    );

    // Line height: probe the words container for the first wrapped word.
    const container = wordsRef.current;
    if (container) {
      const all = container.querySelectorAll<HTMLElement>("[data-word]");
      if (all.length) {
        const top0 = all[0].offsetTop;
        let lh = 0;
        for (let i = 1; i < all.length; i++) {
          if (all[i].offsetTop > top0 + 10) {
            lh = all[i].offsetTop - top0;
            break;
          }
        }
        lineHeightRef.current = lh || all[0].getBoundingClientRect().height;
      }
      // Keep the active line pinned as the second visible line.
      if (lineHeightRef.current > 0 && el) {
        const line = Math.round(el.offsetTop / lineHeightRef.current);
        setOffsetY(line >= 2 ? -(line - 1) * lineHeightRef.current : 0);
      }
    }
  }, [currentIndex, words, containerWidth, overflowCount]);

  // Caret position is pure arithmetic over the cached offsets.
  const caret = useMemo(() => {
    const o = charOffsets;
    if (!o.length) return { top: 0, left: 0 };
    const i = Math.min(userInput.length, o.length - 1);
    if (userInput.length < o.length) return { top: o[i].top, left: o[i].left };
    return { top: o[i].top, left: o[i].left + o[i].w };
  }, [userInput.length, charOffsets]);

  // Solid caret while typing; clear the "typing" flag after a short idle.
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const markTyping = useCallback(() => {
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 700);
  }, []);

  // Only steal focus on non-touch; autoFocus does not raise the mobile keyboard
  // anyway, and doing so scrolls the page around on load.
  useEffect(() => {
    if (isActive && !isTouch) inputRef.current?.focus();
  }, [isActive, isTouch]);

  // "…or press any key to focus": while the surface is unfocused, a plain
  // character keypress hands focus to the hidden input instead of doing nothing.
  // Modifier combos and navigation keys are left alone so browser shortcuts
  // (⌘R, Tab, F5) still work, and touch is excluded — there the keyboard only
  // opens from a real tap.
  //
  // preventDefault matters: the key that buys focus must NOT also be typed.
  // Without it the very first keypress started the test with whatever character
  // the user happened to hit — usually counted as a mistake before they had
  // even begun.
  useEffect(() => {
    if (isFocused || isTouch) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFocused, isTouch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab") {
        // Tab alone used to restart instantly, which meant a reflex reach for
        // Tab threw away a run in progress. It now only arms the restart, the
        // way monkeytype does it — Enter confirms, anything else cancels.
        e.preventDefault();
        setRestartArmed(true);
      } else if (restartArmed && e.key === "Enter") {
        e.preventDefault();
        setRestartArmed(false);
        onRestart?.();
      } else if (restartArmed) {
        setRestartArmed(false);
      } else if (e.key === "Backspace" && userInput.length === 0 && onGoBack) {
        e.preventDefault();
        onGoBack();
      }
    },
    [userInput.length, onRestart, onGoBack, restartArmed],
  );

  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  // Four lines leave enough upcoming text in view to keep the typist oriented,
  // while staying tied to the selected font scale on narrow screens.
  const viewportHeight = "calc(4 * 1.55em + 3 * 0.6em)";
  // Prompt whenever the surface is unfocused, not only mid-test: the most common
  // confusion was on a fresh page, where nothing explained that the words are
  // the click target. Touch gets its own tap prompt below the word area.
  const showRecovery = !isFocused && !isTouch;
  const currentWord = words[currentIndex] ?? "";

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* A <label> makes the click-to-focus native — no div-with-onClick. */}
      <label
        className="typing-surface relative block cursor-text overflow-hidden select-none"
        style={{ height: viewportHeight }}
        data-testid="typing-area"
      >
        <span className="sr-only">{t.typing.inputLabel ?? "Typing input"}</span>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[0.8em] bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[0.8em] bg-gradient-to-t from-background to-transparent" />

        <input
          ref={inputRef}
          type="text"
          className="absolute inset-0 z-20 cursor-text opacity-0"
          value={userInput}
          onChange={(e) => {
            markTyping();
            onInputChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus={!isTouch}
          inputMode="text"
          enterKeyHint="next"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          data-gramm="false"
          data-lpignore="true"
          aria-label={t.typing.inputLabel ?? "Typing input"}
          data-testid="input-typing"
        />

        {/* The visual word list duplicates the input; hide it from AT and expose
            only the current word through a polite live region below. */}
        <div
          ref={wordsRef}
          aria-hidden="true"
          className={cn(
            "relative flex flex-wrap gap-x-4 gap-y-[0.6em] px-2",
            showRecovery && "blur-[3px] opacity-60",
          )}
          style={{
            transform: `translateY(${offsetY}px)`,
            // One declaration: an inline `transition` would otherwise override
            // any Tailwind transition class and the blur would snap instead of
            // fading.
            transition:
              "transform 0.3s cubic-bezier(0.4,0,0.2,1), filter 0.2s ease-out, opacity 0.2s ease-out",
          }}
        >
          {isActive && (
            <span
              className="typing-caret"
              data-typing={typing || undefined}
              style={{ top: caret.top, left: caret.left }}
              data-testid="typing-caret"
            />
          )}

          <PastWords words={words} from={0} to={currentIndex} history={history} />

          <span
            ref={activeWordRef}
            className="whitespace-nowrap"
            data-word="active"
            data-testid={`word-${currentIndex}`}
          >
            {renderChars(currentWord, userInput, false)}
          </span>

          <FutureWords words={words} from={currentIndex + 1} to={renderLimit} />
        </div>

        {showRecovery && (
          <button
            type="button"
            onClick={focusInput}
            // No backdrop tint here: the words themselves carry the blur, so the
            // prompt stays legible without washing the whole surface out.
            className="absolute inset-0 z-30 flex items-center justify-center gap-2 text-base font-medium text-muted-foreground"
            data-testid="typing-focus-prompt"
          >
            <MousePointer2 className="h-4 w-4 shrink-0" />
            {t.typing.clickToContinue ?? "Click here or press any key to focus"}
          </button>
        )}

      </label>

      {isTouch && !isActive && (
        <button
          type="button"
          onClick={focusInput}
          className="mx-auto mt-3 block text-center text-sm font-medium text-muted-foreground"
        >
          {t.typing.tapToType ?? "Tap the text to start typing"}
        </button>
      )}

      {restartArmed && (
        <p
          className="mt-3 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground"
          role="status"
          aria-live="polite"
          data-testid="restart-armed-hint"
        >
          {t.typing.restartConfirm ?? "Press Enter to restart"}
        </p>
      )}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {currentWord}
      </p>
    </div>
  );
}
