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

  // FIX: correctChars faqat to'liq to'g'ri so'zlarni emas, har bir to'g'ri belgi hisoblanadi
  const correctCharsRef = useRef(0);
  const incorrectCharsRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const wpmRef = useRef(0);
  const accuracyRef = useRef(100);
  const [displayStats, setDisplayStats] = useState({ wpm: 0, accuracy: 100 });

  // FIX: live stats yangilanishi uchun interval
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const generateWords = useCallback(() => {
    const list = wordLists[language];
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    const repeated = Array(5).fill(shuffled).flat();
    setWords(repeated);
    setWordStatuses(new Array(repeated.length).fill("pending"));
  }, [language]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
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

    // FIX: Standard WPM formula - har 5 belgi = 1 so'z
    const currentWpm = Math.round((correctCharsRef.current / 5) / elapsedMinutes);
    const total = correctCharsRef.current + incorrectCharsRef.current;
    const currentAccuracy = total === 0 ? 100 : Math.round((correctCharsRef.current / total) * 100);

    wpmRef.current = Math.max(0, currentWpm);
    accuracyRef.current = currentAccuracy;
    setDisplayStats({ wpm: Math.max(0, currentWpm), accuracy: currentAccuracy });
  }, []);

  const finishTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
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

    // FIX: Timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // FIX: Stats har 100ms da yangilanadi (MonkeyType kabi real-time)
    statsIntervalRef.current = setInterval(() => {
      updateLiveStats();
    }, 100);
  }, [finishTest, updateLiveStats]);

  const handleInputChange = useCallback((value: string) => {
    if (isFinished) return;
    if (!isActive && value.length > 0) {
      startTest();
    }

    const word = words[currentIndex];
    if (!word) return;

    if (value.endsWith(" ")) {
      const typedWord = value.trim();

      if (typedWord.length === 0) {
        setUserInput("");
        return;
      }

      // FIX: So'z to'g'ri yoki noto'g'ri baholanadi
      const isCorrect = typedWord === word;

      if (isCorrect) {
        correctCharsRef.current += word.length + 1; // +1 bo'sh joy uchun
      } else {
        // FIX: Noto'g'ri so'zdagi to'g'ri harflarni ham hisoblash
        const minLen = Math.min(typedWord.length, word.length);
        for (let i = 0; i < minLen; i++) {
          if (typedWord[i] === word[i]) {
            correctCharsRef.current += 1;
          } else {
            incorrectCharsRef.current += 1;
          }
        }
        // Ortiqcha yoki kam harflar
        if (typedWord.length > word.length) {
          incorrectCharsRef.current += typedWord.length - word.length;
        } else if (typedWord.length < word.length) {
          incorrectCharsRef.current += word.length - typedWord.length;
        }
      }

      setWordStatuses(prev => {
        const next = [...prev];
        next[currentIndex] = isCorrect ? "correct" : "incorrect";
        return next;
      });

      setCurrentIndex(prev => prev + 1);
      setUserInput("");
      updateLiveStats();
    } else {
      // FIX: Faqat yangi qo'shilgan belgini hisoblash (o'chirish hisoblanmaydi)
      if (value.length > userInput.length) {
        const newCharIndex = value.length - 1;
        const targetChar = word[newCharIndex];
        const typedChar = value[newCharIndex];

        if (targetChar !== undefined) {
          if (typedChar === targetChar) {
            correctCharsRef.current += 1;
          } else {
            incorrectCharsRef.current += 1;
          }
        } else {
          // Ortiqcha belgi (so'zdan uzun)
          incorrectCharsRef.current += 1;
        }
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
