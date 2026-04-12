import { useState, useEffect, useCallback, useRef } from "react";
import { words as wordLists } from "@shared/words";
import type { Language } from "@/components/language-selector";
import type { TimerMode } from "@/components/timer-mode-selector";

interface UseTypingTestProps {
  language: Language;
  mode: TimerMode;
  onComplete: (stats: {
    wpm: number;
    accuracy: number;
    correctChars: number;
    incorrectChars: number;
  }) => void;
}

export type WordStatus = "correct" | "incorrect" | "pending";

export function useTypingTest({ language, mode, onComplete }: UseTypingTestProps) {
  const [words, setWords] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(mode);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // FIX: correctChars  — faqat to'g'ri bosilgan harflar
  // FIX: allKeystrokes — barcha bosilgan tugmalar (backspace hisoblanmaydi)
  const correctCharsRef = useRef(0);
  const allKeystrokesRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const wpmRef = useRef(0);
  const accuracyRef = useRef(100);
  const [displayStats, setDisplayStats] = useState({ wpm: 0, accuracy: 100, rawWpm: 0, consistency: 100 });
  const keystrokeIntervalsRef = useRef<number[]>([]);
  const lastKeystrokeTimeRef = useRef<number | null>(null);
  const rawWpmRef = useRef(0);
  const consistencyRef = useRef(100);

  // FIX: live stats yangilanishi uchun interval
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const generateWords = useCallback(() => {
    const pool = wordLists[language];
    const generated: string[] = [];

    // Yengil va takrorlanmas tizim: har 500 ta so'z kerak bo'lsa
    // hamma lug'atni aralashtirib qo'shamiz, lug'at tugasa yana aralashtirib qo'shamiz.
    // Shunda bitta ekranda ayni bir so'z yaqin o'rinlarda umuman qaytarilmaydi!
    while (generated.length < 500) {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);

      // Ikkita ketma-ket bir xil so'z tushib qolmasligi uchun kichik tekshiruv (ikki blok orasida)
      if (generated.length > 0 && shuffled[0] === generated[generated.length - 1]) {
        const temp = shuffled[0];
        shuffled[0] = shuffled[1];
        shuffled[1] = temp;
      }

      generated.push(...shuffled);
    }

    // Faqat oxirgi 500 tasini olamiz
    setWords(generated.slice(0, 500));
    setHistory([]);
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
    allKeystrokesRef.current = 0;
    wpmRef.current = 0;
    accuracyRef.current = 100;
    rawWpmRef.current = 0;
    consistencyRef.current = 100;
    keystrokeIntervalsRef.current = [];
    lastKeystrokeTimeRef.current = null;
    startTimeRef.current = null;
    setDisplayStats({ wpm: 0, accuracy: 100, rawWpm: 0, consistency: 100 });
  }, [generateWords, mode]);

  useEffect(() => {
    reset();
  }, [reset]);

  const updateLiveStats = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
    if (elapsedMinutes <= 0) return;

    // FIX: WPM = (faqat to'g'ri harflar / 5) / o'tgan daqiqa
    const currentWpm = Math.round(correctCharsRef.current / 5 / elapsedMinutes);

    // FIX: Accuracy = (To'g'ri harflar / barcha bosilgan harflar) * 100
    const currentAccuracy =
      allKeystrokesRef.current === 0
        ? 100
        : Math.round((correctCharsRef.current / allKeystrokesRef.current) * 100);

    const currentRawWpm = Math.round(allKeystrokesRef.current / 5 / elapsedMinutes);

    // Consistency
    const intervals = keystrokeIntervalsRef.current;
    let currentConsistency = 100;
    if (intervals.length >= 2) {
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / mean;
      currentConsistency = Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
    }

    wpmRef.current = Math.max(0, currentWpm);
    accuracyRef.current = currentAccuracy;
    rawWpmRef.current = currentRawWpm;
    consistencyRef.current = currentConsistency;

    setDisplayStats({ 
       wpm: Math.max(0, currentWpm), 
       accuracy: currentAccuracy,
       rawWpm: currentRawWpm,
       consistency: currentConsistency
    });
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
      rawWpm: rawWpmRef.current,
      consistency: consistencyRef.current,
      correctChars: correctCharsRef.current,
      incorrectChars: Math.max(0, allKeystrokesRef.current - correctCharsRef.current),
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

    statsIntervalRef.current = setInterval(() => {
      updateLiveStats();
    }, 100);
  }, [finishTest, updateLiveStats]);

  const handleInputChange = useCallback(
    (value: string) => {
      if (isFinished) return;
      if (!isActive && value.length > 0) {
        startTest();
      }

      const word = words[currentIndex];
      if (!word) return;

      if (value.endsWith(" ") || value.endsWith("\u00A0")) {
        const currentTyped = value.slice(0, -1);

        // Tezkor yozishda: State birdaniga yangilanib probel bilan qo'shilib qolgan harflarni hisoblash
        if (currentTyped.length > userInput.length) {
          const addedLen = currentTyped.length - userInput.length;
          allKeystrokesRef.current += addedLen;
          for (let i = userInput.length; i < currentTyped.length; i++) {
            const targetChar = word[i];
            const typedChar = currentTyped[i];
            if (targetChar !== undefined && typedChar === targetChar) {
              correctCharsRef.current += 1;
            }
          }
        } else if (currentTyped.length < userInput.length) {
          for (let i = currentTyped.length; i < userInput.length; i++) {
            const targetChar = word[i];
            const deletedChar = userInput[i];
            if (targetChar !== undefined && deletedChar === targetChar) {
              correctCharsRef.current -= 1;
            }
          }
        }

        // Probel bosildi -> bitta tugma
        allKeystrokesRef.current += 1;

        // Agar so'z to'liq to'g'ri bo'lsa, probel ham to'g'ri belgi sifatida hisoblanadi
        const isCorrect = currentTyped === word;
        if (isCorrect) {
          correctCharsRef.current += 1;
        }

        setHistory((prev) => [...prev, currentTyped]);
        setCurrentIndex((prev) => prev + 1);
        setUserInput("");
        updateLiveStats();
      } else {
        if (value.length > userInput.length) {
          // Harf qo'shildi
          const addedLen = value.length - userInput.length;
          allKeystrokesRef.current += addedLen;

          for (let i = userInput.length; i < value.length; i++) {
            const targetChar = word[i];
            const typedChar = value[i];
            if (targetChar !== undefined && typedChar === targetChar) {
              correctCharsRef.current += 1;
            }
          }
        } else if (value.length < userInput.length) {
          // Backspace bosildi (allKeystrokes kamaymaydi!)
          for (let i = value.length; i < userInput.length; i++) {
            const targetChar = word[i];
            const deletedChar = userInput[i];
            if (targetChar !== undefined && deletedChar === targetChar) {
              correctCharsRef.current -= 1; // Avval to'g'ri deb sanalgan harf o'chirildi, wpm dan ayriladi
            }
          }
        }

        setUserInput(value);
      }

      // Consistency tracking
      const now = Date.now();
      if (lastKeystrokeTimeRef.current) {
        const interval = now - lastKeystrokeTimeRef.current;
        if (interval < 2000) {
          keystrokeIntervalsRef.current.push(interval);
        }
      }
      lastKeystrokeTimeRef.current = now;

    },
    [isFinished, isActive, userInput, words, currentIndex, startTest, updateLiveStats]
  );

  const handleGoBack = useCallback(() => {
    // Agar xato qilib so'zni tugatib qo'ygan bo'lsa va backspace bosa (userInput bo'sh bo'lganda)
    if (currentIndex > 0 && userInput.length === 0) {
      const prevWordIdx = currentIndex - 1;
      const prevWordTarget = words[prevWordIdx];
      const prevInput = history[prevWordIdx];

      // Faqat xato yozilgan so'z bo'lsagina orqaga qaytish mumkin
      if (prevInput === prevWordTarget) return;

      setHistory((prev) => prev.slice(0, -1));
      setCurrentIndex(prevWordIdx);
      setUserInput(prevInput);

      // Probel bosilgan vaqtda faqat allKeystrokes oshgandi (chunki so'z xato edi). Probelni ayirib tashlaymiz.
      allKeystrokesRef.current = Math.max(0, allKeystrokesRef.current - 1);

      updateLiveStats();
    }
  }, [currentIndex, userInput, history, words, updateLiveStats]);

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
      rawWpm: displayStats.rawWpm,
      consistency: displayStats.consistency,
      correctChars: correctCharsRef.current,
      incorrectChars: Math.max(0, allKeystrokesRef.current - correctCharsRef.current),
    },
    history,
    handleInputChange,
    handleGoBack,
    reset,
  };
}
