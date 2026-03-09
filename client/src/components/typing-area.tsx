import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TypingAreaProps {
  words: string[];
  userInput: string;
  onInputChange: (value: string) => void;
  onComplete: () => void;
  isActive: boolean;
  currentIndex: number;
}

export function TypingArea({
  words,
  userInput,
  onInputChange,
  onComplete,
  isActive,
  currentIndex,
}: TypingAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive]);

  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeWord = activeWordRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const wordRect = activeWord.getBoundingClientRect();
      
      if (wordRect.bottom > containerRect.bottom - 20) {
        container.scrollTop += wordRect.height + 8;
      }
    }
  }, [currentIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      onComplete(); // Use as reset for now or handle separately
    }
  };

  const renderChar = (char: string, wordIdx: number, charIdx: number) => {
    let colorClass = "text-pending";
    const isCurrentWord = wordIdx === currentIndex;
    const isPastWord = wordIdx < currentIndex;

    if (isPastWord) {
      colorClass = "text-correct";
    } else if (isCurrentWord) {
      if (charIdx < userInput.length) {
        colorClass = userInput[charIdx] === char ? "text-correct" : "text-error underline decoration-error/50";
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
            className="absolute left-0 top-0 w-0.5 h-full bg-caret animate-pulse" 
            data-testid="typing-caret"
          />
        )}
        {char}
      </span>
    );
  };

  return (
    <div 
      className="relative w-full max-w-4xl mx-auto h-32 overflow-hidden cursor-text"
      onClick={() => inputRef.current?.focus()}
      ref={containerRef}
      data-testid="typing-area"
    >
      <input
        ref={inputRef}
        type="text"
        className="absolute inset-0 opacity-0 cursor-default"
        value={userInput}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!isActive}
        autoFocus
        data-testid="input-typing"
      />
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-2xl font-mono leading-relaxed select-none">
        {words.map((word, wordIdx) => (
          <span
            key={wordIdx}
            ref={wordIdx === currentIndex ? activeWordRef : null}
            className={cn(
              "relative whitespace-nowrap",
              wordIdx === currentIndex && "bg-muted/20 rounded-sm"
            )}
            data-testid={`word-${wordIdx}`}
          >
            {word.split("").map((char, charIdx) => renderChar(char, wordIdx, charIdx))}
          </span>
        ))}
      </div>
    </div>
  );
}
