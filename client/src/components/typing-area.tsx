import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { WordStatus } from "@/hooks/use-typing-test";

interface TypingAreaProps {
  words: string[];
  userInput: string;
  onInputChange: (value: string) => void;
  onComplete: () => void;
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

const WordBox = React.memo(React.forwardRef<HTMLSpanElement, WordBoxProps>(({
  word, wordIdx, isActive, isPast, typedWord
}, ref) => {
  if (!isActive && !isPast) {
    return (
      <span ref={ref} className="relative whitespace-nowrap text-muted-foreground/50 transition-colors" data-testid={`word-${wordIdx}`}>
        {word}
      </span>
    );
  }

  const renderChar = (char: string, charIdx: number) => {
    let colorClass = "text-muted-foreground/50";

    if (charIdx < typedWord.length) {
      // User has typed something for this position
      const typedChar = typedWord[charIdx];
      if (typedChar === char) {
        colorClass = "text-green-500 dark:text-green-400 font-medium";
      } else {
        colorClass = "text-red-500 dark:text-red-400 font-bold";
      }
    } else if (isPast) {
      // User completely missed this char (skipped with space)
      colorClass = "text-red-500 underline decoration-red-500/50 decoration-2 font-bold opacity-80";
    }

    return (
      <span
        key={`${wordIdx}-${charIdx}`}
        className={cn("transition-colors duration-75", colorClass)}
      >
        {charIdx < typedWord.length && typedWord[charIdx] !== char && !isPast ? typedWord[charIdx] : char}
      </span>
    );
  };

  return (
    <span
      ref={ref}
      className={cn(
        "relative whitespace-nowrap transition-all duration-200",
        isActive && "bg-primary/5 rounded-md px-1 -mx-1"
      )}
      data-testid={`word-${wordIdx}`}
    >
      {/* Caret */}
      {isActive && (
        <span 
          className="absolute top-[10%] w-[3px] h-[80%] bg-primary animate-[blink_1s_step-end_infinite] rounded-full z-10 transition-transform duration-100 ease-out"
          style={{ 
            transform: `translateX(calc(${typedWord.length}ch - 1px))`,
            boxShadow: "0 0 8px var(--primary)",
            left: "0.25rem" // Adjust to match the padding of container if necessary, but font is mono so it should align.
          }}
          data-testid="typing-caret"
        />
      )}

      {/* Word Characters */}
      {word.split("").map((char, charIdx) => renderChar(char, charIdx))}

      {/* Extra characters typed beyond word length */}
      {typedWord.length > word.length &&
        typedWord.slice(word.length).split("").map((char, charIdx) => (
          <span
            key={`extra-${charIdx}`}
            className="text-red-500 underline decoration-red-500/50 font-bold opacity-80"
          >
            {char}
          </span>
        ))
      }
    </span>
  );
}));

WordBox.displayName = "WordBox";

export function TypingArea({
  words,
  userInput,
  onInputChange,
  onComplete,
  isActive,
  currentIndex,
  history = [],
}: TypingAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  const [offsetY, setOffsetY] = useState(0);
  const lineHeightRef = useRef(0);
  const lastLineRef = useRef(0);

  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (!activeWordRef.current || !containerRef.current || !wordsRef.current) return;

    const container = containerRef.current;
    const activeWord = activeWordRef.current;
    const containerRect = container.getBoundingClientRect();

    if (lineHeightRef.current === 0) {
      const firstWord = wordsRef.current.querySelector("span");
      if (firstWord) {
        lineHeightRef.current = firstWord.getBoundingClientRect().height + 12; // gap-y-3
      }
    }

    const wordRect = activeWord.getBoundingClientRect();
    const wordTop = wordRect.top - containerRect.top;

    if (wordTop > lineHeightRef.current * 1.5 && lineHeightRef.current > 0) {
      const currentLine = Math.floor(wordTop / lineHeightRef.current);
      if (currentLine > lastLineRef.current) {
        lastLineRef.current = currentLine;
        setOffsetY(prev => prev - lineHeightRef.current);
      }
    }
  }, [currentIndex]);

  useEffect(() => {
    setOffsetY(0);
    lastLineRef.current = 0;
    lineHeightRef.current = 0;
  }, [words]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      onComplete();
    }
  };

  return (
    <div
      className="relative w-full max-w-5xl mx-auto h-[7rem] overflow-hidden cursor-text"
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
        className="flex flex-wrap gap-x-3 gap-y-3 text-[1.7rem] font-mono leading-relaxed select-none px-2"
        style={{
          transform: `translateY(${offsetY}px)`,
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
        }}
      >
        {words.map((word, wordIdx) => {
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
        })}
      </div>
    </div>
  );
}
