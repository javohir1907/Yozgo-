import { useState, useEffect, useCallback, useRef } from "react";
import { words as wordLists } from "@shared/words";
import type { Language } from "@/components/language-selector";
import type { TimerMode } from "@/components/timer-mode-selector";

interface UseTypingTestProps {
  language: Language;
  mode: TimerMode;
  onComplete: (stats: { wpm: number; accuracy: number; correctChars: number; incorrectChars: number }) => void;
}

export type WordStatus = "correct" | "incorrect" | "pending";

export function useTypingTest({ language, mode, onComplete }: UseTypingTestProps) {
  const [words, setWords] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(mode);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);

  const correctCharsRef = useRef(0);
  const incorrectCharsRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const wpmRef = useRef(0);
  const accuracyRef = useRef(100);
  const [displayStats, setDisplayStats] = useState({ wpm: 0, accuracy: 100 });

  const generateWords = useCallback(() => {
    const list = wordLists[language];
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    const repeated = Array(5).fill(shuffled).flat();
    setWords(repeated);
    setWordStatuses(new Array(repeated.length).fill("pending"));
  }, [language]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    generateWords();
    setUserInput("");
    setCurrentIndex(0);
    setTimeLeft(mode);
    setIsActive(false);
    setIsFinished(false);
    correctCharsRef.current = 0;
    incorrectCharsRef.current = 0;
    wpmRef.current = 0;
    accuracyRef.current = 100;
    startTimeRef.current = null;
    setDisplayStats({ wpm: 0, accuracy: 100 });
  }, [generateWords, mode]);

  useEffect(() => {
    reset();
  }, [reset]);

  const updateLiveStats = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
    if (elapsedMinutes <= 0) return;

    const currentWpm = Math.round((correctCharsRef.current / 5) / elapsedMinutes);
    const total = correctCharsRef.current + incorrectCharsRef.current;
    const currentAccuracy = total === 0 ? 100 : Math.round((correctCharsRef.current / total) * 100);

    wpmRef.current = currentWpm;
    accuracyRef.current = currentAccuracy;
    setDisplayStats({ wpm: currentWpm, accuracy: currentAccuracy });
  }, []);

  const finishTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFinished(true);

    updateLiveStats();

    onComplete({
      wpm: wpmRef.current,
      accuracy: accuracyRef.current,
      correctChars: correctCharsRef.current,
      incorrectChars: incorrectCharsRef.current,
    });
  }, [onComplete, updateLiveStats]);

  const startTest = useCallback(() => {
    setIsActive(true);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [finishTest]);

  const handleInputChange = useCallback((value: string) => {
    if (isFinished) return;
    if (!isActive && value.length > 0) {
      startTest();
    }

    if (value.endsWith(" ")) {
      const word = words[currentIndex];
      const typedWord = value.trim();

      // Only advance if the typed word is exactly the same as target word
      if (typedWord === word) {
        correctCharsRef.current += word.length + 1; // +1 for space

        setWordStatuses(prev => {
          const next = [...prev];
          next[currentIndex] = "correct";
          return next;
        });

        setCurrentIndex(prev => prev + 1);
        setUserInput("");
        updateLiveStats();
      } else {
        // If word is incomplete or incorrect when space is pressed
        incorrectCharsRef.current += 1;
        updateLiveStats();
      }
    } else {
      // Check for incorrect keystrokes while typing
      const word = words[currentIndex];
      if (value.length > userInput.length) {
        // Only count as incorrect if the character added doesn't match the target word
        const lastChar = value[value.length - 1];
        const targetChar = word[value.length - 1];

        if (lastChar === targetChar) {
          correctCharsRef.current += 1;
        } else {
          incorrectCharsRef.current += 1;
        }
        updateLiveStats();
      }
      setUserInput(value);
    }
  }, [isFinished, isActive, userInput, words, currentIndex, startTest, updateLiveStats]);

  return {
    words,
    userInput,
    currentIndex,
    timeLeft,
    isActive,
    isFinished,
    stats: {
      wpm: displayStats.wpm,
      accuracy: displayStats.accuracy,
      correctChars: correctCharsRef.current,
      incorrectChars: incorrectCharsRef.current,
    },
    wordStatuses,
    handleInputChange,
    reset,
  };
}
