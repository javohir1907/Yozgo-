import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { WordStatus } from "@/hooks/use-typing-test";

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

interface WordBoxProps {
  word: string;
  wordIdx: number;
  isActive: boolean;
  isPast: boolean;
  typedWord: string; // The word the user actually typed (past or current)
}

const WordBox = React.memo(
  React.forwardRef<HTMLSpanElement, WordBoxProps>(
    ({ word, wordIdx, isActive, isPast, typedWord }, ref) => {
      if (!isActive && !isPast) {
        return (
          <span
            ref={ref}
            className="inline-block whitespace-nowrap text-muted-foreground/80 transition-colors word-box"
            data-testid={`word-${wordIdx}`}
          >
            {word.split("").map((char, charIdx) => (
              <span key={charIdx} className="char-span">
                {char}
              </span>
            ))}
          </span>
        );
      }

      const renderChar = (char: string, charIdx: number) => {
        let colorClass = "text-muted-foreground/80";

        if (charIdx < typedWord.length) {
          const typedChar = typedWord[charIdx];
          if (typedChar === char) {
            colorClass = "text-green-600 dark:text-green-400 font-bold";
          } else {
            colorClass = "text-white bg-red-600 dark:text-red-400 dark:bg-red-500/10 font-bold rounded-sm px-[1px]";
          }
        } else if (isPast) {
          colorClass =
            "text-red-700 dark:text-red-500 underline decoration-red-600/60 decoration-2 font-bold opacity-90";
        }

        return (
          <span
            key={`${wordIdx}-${charIdx}`}
            className={cn("char-span inline-block", colorClass)}
          >
            {char}
          </span>
        );
      };

      return (
        <span
          ref={ref}
          className={cn(
            "inline-block whitespace-nowrap word-box",
            isActive && "bg-primary/5 rounded-md px-1 -mx-1"
          )}
          data-testid={`word-${wordIdx}`}
        >
          {/* Word Characters */}
          {word.split("").map((char, charIdx) => renderChar(char, charIdx))}

          {/* Extra characters typed beyond word length */}
          {typedWord.length > word.length &&
            typedWord
              .slice(word.length)
              .split("")
              .map((char, charIdx) => (
                <span
                  key={`extra-${charIdx}`}
                  className="text-white bg-red-600 dark:text-red-500 dark:bg-transparent underline decoration-red-500/50 font-bold opacity-90 char-span inline-block px-[1px] rounded-sm"
                >
                  {char}
                </span>
              ))}
        </span>
      );
    }
  )
);

WordBox.displayName = "WordBox";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  const [offsetY, setOffsetY] = useState(0);
  const [caretPos, setCaretPos] = useState({ top: 0, left: 0 });
  const lineHeightRef = useRef(0);
  const lastLineRef = useRef(0);

  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive]);

  // Handle caret positioning
  useEffect(() => {
    if (!wordsRef.current || !activeWordRef.current) return;

    const wordEl = activeWordRef.current;
    const chars = wordEl.querySelectorAll(".char-span");
    const inputLen = userInput.length;

    let top = 0;
    let left = 0;

    if (inputLen < chars.length) {
      const el = chars[inputLen] as HTMLElement;
      top = el.offsetTop;
      left = el.offsetLeft;
    } else if (chars.length > 0) {
      const el = chars[chars.length - 1] as HTMLElement;
      top = el.offsetTop;
      left = el.offsetLeft + el.offsetWidth;
    } else {
      top = wordEl.offsetTop;
      left = wordEl.offsetLeft;
    }

    setCaretPos({ top, left });
  }, [currentIndex, userInput]);

  useEffect(() => {
    if (!activeWordRef.current || !containerRef.current || !wordsRef.current) return;

    const activeWord = activeWordRef.current;

    if (lineHeightRef.current === 0) {
      const firstWord = wordsRef.current.querySelector(".word-box") as HTMLElement;
      const allWords = wordsRef.current.querySelectorAll(".word-box");

      if (firstWord && allWords.length > 0) {
        const top0 = firstWord.offsetTop;

        // Find the first word that wrapped to the second line
        for (let i = 1; i < allWords.length; i++) {
          const el = allWords[i] as HTMLElement;
          if (el.offsetTop > top0 + 10) {
            lineHeightRef.current = el.offsetTop - top0;
            break;
          }
        }

        // Fallback agar baribir topilmasa (misol bir qatordan iborat holatda)
        if (lineHeightRef.current === 0) {
          lineHeightRef.current = firstWord.getBoundingClientRect().height + 12; // gap-y-3
        }
      }
    }

    if (lineHeightRef.current > 0) {
      const wordTop = activeWord.offsetTop;
      const currentLine = Math.round(wordTop / lineHeightRef.current);

      if (currentLine >= 2) {
        setOffsetY(-(currentLine - 1) * lineHeightRef.current);
      } else {
        setOffsetY(0);
      }
    }
  }, [currentIndex]);

  useEffect(() => {
    setOffsetY(0);
    lastLineRef.current = 0;
    lineHeightRef.current = 0;
  }, [words]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        if (onRestart) onRestart();
      }
      if (e.key === "Backspace" && userInput.length === 0 && onGoBack) {
        e.preventDefault();
        onGoBack();
      }
    },
    [userInput.length, onRestart, onGoBack]
  );

  const renderedWords = React.useMemo(() => {
    return words.map((word, wordIdx) => {
      let typedWord = "";
      if (wordIdx < currentIndex) {
        typedWord = history[wordIdx] || "";
      } else if (wordIdx === currentIndex) {
        typedWord = userInput;
      }

      return (
        <WordBox
          key={wordIdx}
          ref={wordIdx === currentIndex ? activeWordRef : null}
          word={word}
          wordIdx={wordIdx}
          isActive={wordIdx === currentIndex}
          isPast={wordIdx < currentIndex}
          typedWord={typedWord}
        />
      );
    });
  }, [words, currentIndex, history, userInput]);

  return (
    <div
      className="relative w-full max-w-5xl mx-auto h-[10.5rem] overflow-hidden cursor-text"
      onClick={() => inputRef.current?.focus()}
      ref={containerRef}
      data-testid="typing-area"
    >
      <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

      <input
        ref={inputRef}
        type="text"
        className="absolute inset-0 opacity-0 cursor-default z-20"
        value={userInput}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        data-testid="input-typing"
      />

      <div
        ref={wordsRef}
        className="flex flex-wrap gap-x-3 gap-y-3 text-[1.5rem] md:text-[1.6rem] font-mono leading-relaxed select-none px-2 relative"
        style={{
          transform: `translateY(${offsetY}px)`,
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* New precise caret */}
        {isActive && (
          <div
            className="absolute rounded-full z-10 transition-all duration-75 ease-out shadow-[0_0_8px_var(--primary)] bg-primary"
            style={{
              top: `${caretPos.top}px`,
              left: `${caretPos.left}px`,
              width: "3px",
              height: "1.4em", // Match character height roughly
              animation: "blink 1s step-end infinite",
              marginTop: "0.1em", // tiny tweak to align vertically with text
            }}
            data-testid="typing-caret"
          />
        )}

        {renderedWords}
      </div>
    </div>
  );
}
