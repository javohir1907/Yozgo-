import { useState, useEffect, useCallback, useRef } from "react";
import { words as wordLists } from "@shared/words";
import type { Language } from "@/components/language-selector";
import type { TimerMode } from "@/components/timer-mode-selector";

interface UseTypingTestProps {
  language: Language;
  mode: TimerMode;
  onComplete: (stats: { wpm: number; accuracy: number; correctChars: number; incorrectChars: number }) => void;
}

export function useTypingTest({ language, mode, onComplete }: UseTypingTestProps) {
  const [words, setWords] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(mode);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState({
    wpm: 0,
    accuracy: 0,
    correctChars: 0,
    incorrectChars: 0,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const generateWords = useCallback(() => {
    const list = wordLists[language];
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    // Generate enough words for the duration
    const repeated = Array(5).fill(shuffled).flat();
    setWords(repeated);
  }, [language]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    generateWords();
    setUserInput("");
    setCurrentIndex(0);
    setTimeLeft(mode);
    setIsActive(false);
    setIsFinished(false);
    setStats({ wpm: 0, accuracy: 0, correctChars: 0, incorrectChars: 0 });
    startTimeRef.current = null;
  }, [generateWords, mode]);

  useEffect(() => {
    reset();
  }, [reset]);

  const startTest = () => {
    setIsActive(true);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishTest();
          return 0;
        }
        return (prev - 1) as TimerMode;
      });
    }, 1000);
  };

  const finishTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setIsFinished(true);
    
    // Final calculation is already being updated by live stats, 
    // but we ensure onComplete gets the latest
    setStats(prev => {
      onComplete(prev);
      return prev;
    });
  }, [onComplete]);

  const handleInputChange = (value: string) => {
    if (isFinished) return;
    if (!isActive && value.length > 0) {
      startTest();
    }

    if (value.endsWith(" ")) {
      // Word completed
      const word = words[currentIndex];
      const typedWord = value.trim();
      
      let newCorrect = stats.correctChars;
      let newIncorrect = stats.incorrectChars;

      // Compare typed word with actual word
      for (let i = 0; i < word.length; i++) {
        if (i < typedWord.length) {
          if (typedWord[i] === word[i]) newCorrect++;
          else newIncorrect++;
        } else {
          // Missed characters in the word are counted as incorrect
          newIncorrect++;
        }
      }
      
      // Also count extra characters typed as incorrect
      if (typedWord.length > word.length) {
        newIncorrect += typedWord.length - word.length;
      }
      
      // Count the space as a correct char if the word was mostly correct? 
      // Monkeytype usually counts spaces too.
      newCorrect++; 

      setStats(prev => ({
        ...prev,
        correctChars: newCorrect,
        incorrectChars: newIncorrect
      }));

      setCurrentIndex(prev => prev + 1);
      setUserInput("");
    } else {
      setUserInput(value);
    }
  };

  // Live WPM and Accuracy calculation
  useEffect(() => {
    if (!isActive || !startTimeRef.current) return;

    const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
    if (elapsedMinutes === 0) return;

    // WPM = (correct chars / 5) / minutes
    const currentWpm = Math.round((stats.correctChars / 5) / elapsedMinutes);
    const totalAttempted = stats.correctChars + stats.incorrectChars;
    const currentAccuracy = totalAttempted === 0 ? 100 : Math.round((stats.correctChars / totalAttempted) * 100);

    setStats(prev => ({
      ...prev,
      wpm: currentWpm,
      accuracy: currentAccuracy
    }));
  }, [isActive, stats.correctChars, stats.incorrectChars]);

  return {
    words,
    userInput,
    currentIndex,
    timeLeft,
    isActive,
    isFinished,
    stats,
    handleInputChange,
    reset,
  };
}
