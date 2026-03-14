import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { WordStatus } from "@/hooks/use-typing-test";

interface TypingAreaProps {
  words: string[];
  userInput: string;
  onInputChange: (value: string) => void;
  onComplete: () => void;
  isActive: boolean;
  currentIndex: number;
  wordStatuses?: WordStatus[];
}

export function TypingArea({
  words,
  userInput,
  onInputChange,
  onComplete,
  isActive,
  currentIndex,
  wordStatuses,
}: TypingAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // FIX: translateY bilan smooth scroll (MonkeyType usuli)
  const [offsetY, setOffsetY] = useState(0);
  const lineHeightRef = useRef(0);
  const lastLineRef = useRef(0);

  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive]);

  // FIX: Har so'z o'zgarganda smooth scroll
  useEffect(() => {
    if (!activeWordRef.current || !containerRef.current || !wordsRef.current) return;

    const container = containerRef.current;
    const activeWord = activeWordRef.current;
    const containerRect = container.getBoundingClientRect();

    // Line height ni birinchi so'zdan olish
    if (lineHeightRef.current === 0) {
      const firstWord = wordsRef.current.querySelector("span");
      if (firstWord) {
        lineHeightRef.current = firstWord.getBoundingClientRect().height + 8; // gap-y-2 = 8px
      }
    }

    const wordRect = activeWord.getBoundingClientRect();
    // Container ichidagi relative pozitsiya
    const wordTop = wordRect.top - containerRect.top;

    // Agar so'z 2-qatorga o'tsa, scroll qilish
    if (wordTop > lineHeightRef.current * 1.5 && lineHeightRef.current > 0) {
      const currentLine = Math.floor(wordTop / lineHeightRef.current);
      if (currentLine > lastLineRef.current) {
        lastLineRef.current = currentLine;
        setOffsetY(prev => prev - lineHeightRef.current);
      }
    }
  }, [currentIndex]);

  // Reset offset when words regenerated
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

  const renderChar = (char: string, wordIdx: number, charIdx: number) => {
    let colorClass = "text-pending";
    const isCurrentWord = wordIdx === currentIndex;
    const isPastWord = wordIdx < currentIndex;

    if (isPastWord) {
      const status = wordStatuses?.[wordIdx] ?? "correct";
      colorClass = status === "correct" ? "text-correct" : "text-error";
    } else if (isCurrentWord) {
      if (charIdx < userInput.length) {
        colorClass = userInput[charIdx] === char
          ? "text-correct"
          : "text-error underline decoration-error/50";
      }
    }

    const isCaretPosition = isCurrentWord && charIdx === userInput.length;

    return (
      <span
        key={`${wordIdx}-${charIdx}`}
        className={cn("relative", colorClass)}
      >
        {isCaretPosition && (
          <span
            className="absolute left-0 top-0 w-0.5 h-full bg-caret animate-[blink_1s_step-end_infinite]"
            data-testid="typing-caret"
          />
        )}
        {char}
      </span>
    );
  };

  return (
    <div
      className="relative w-full max-w-4xl mx-auto h-[5.5rem] overflow-hidden cursor-text"
      onClick={() => inputRef.current?.focus()}
      ref={containerRef}
      data-testid="typing-area"
    >
      {/* FIX: Gradient top/bottom - o'tgan so'zlarni yashirish uchun */}
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
        data-testid="input-typing"
      />

      {/* FIX: transform: translateY bilan smooth scroll - scrollTop emas! */}
      <div
        ref={wordsRef}
        className="flex flex-wrap gap-x-4 gap-y-2 text-2xl font-mono leading-relaxed select-none"
        style={{
          transform: `translateY(${offsetY}px)`,
          transition: "transform 0.15s ease", // Silliq animatsiya
        }}
      >
        {words.map((word, wordIdx) => {
          const isPast = wordIdx < currentIndex;
          const isCurrent = wordIdx === currentIndex;
          const status = wordStatuses?.[wordIdx];

          return (
            <span
              key={wordIdx}
              ref={isCurrent ? activeWordRef : null}
              className={cn(
                "relative whitespace-nowrap",
                isCurrent && "bg-muted/20 rounded-sm",
                isPast && status === "incorrect" && "underline decoration-error/40 decoration-2 underline-offset-4"
              )}
              data-testid={`word-${wordIdx}`}
            >
              {word.split("").map((char, charIdx) => renderChar(char, wordIdx, charIdx))}

              {/* Ortiqcha belgilar */}
              {isCurrent && userInput.length > word.length &&
                userInput.slice(word.length).split("").map((char, charIdx) => (
                  <span
                    key={`extra-${charIdx}`}
                    className="text-error underline decoration-error/50 opacity-70"
                  >
                    {char}
                  </span>
                ))
              }

              {/* FIX: Kursor so'z oxirida bo'lsa */}
              {isCurrent && userInput.length === word.length && (
                <span className="relative">
                  <span
                    className="absolute left-0 top-0 w-0.5 h-full bg-caret animate-[blink_1s_step-end_infinite]"
                  />
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
