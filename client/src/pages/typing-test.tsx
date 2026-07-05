import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTypingTest } from "@/hooks/use-typing-test";
import { TypingArea } from "@/components/typing-area";
import { StatsDisplay } from "@/components/stats-display";
import { LanguageSelector, type Language } from "@/components/language-selector";
import { TimerModeSelector, type TimerMode } from "@/components/timer-mode-selector";
import { ResultCard } from "@/components/result-card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

// Idempotency kaliti (v4 UUID). crypto.randomUUID zamonaviy brauzerlarda bor;
// bo'lmasa getRandomValues bilan yaroqli v4 fallback.
function makeClientResultId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fallback'ga o'tamiz */
  }
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(b);
  } else {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function TypingTestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<Language>("en");
  const [mode, setMode] = useState<TimerMode>(30);

  const resultMutation = useMutation({
    mutationFn: async (result: {
      wpm: number;
      accuracy: number;
      rawWpm: number;
      consistency: number;
      language: string;
      mode: string;
      clientResultId: string; // idempotency kaliti — retry'da o'zgarmaydi
    }) => {
      const res = await apiRequest("POST", "/api/results", result);
      return res.json();
    },
    onSuccess: () => {
      // Leaderboard sahifasi kalit sifatida to'liq URL ishlatadi (masalan
      // "/api/leaderboard?language=uz"), shuning uchun oddiy ["/api/leaderboard"]
      // bilan mos kelmaydi. predicate orqali barcha leaderboard kalitlarini yangilaymiz.
      // Gamifikatsiya: quest/liga/profil ham test'dan keyin yangilanadi.
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return (
            typeof k === "string" &&
            (k.startsWith("/api/leaderboard") ||
              k.startsWith("/api/quests") ||
              k.startsWith("/api/league") ||
              k.startsWith("/api/profile"))
          );
        },
      });
    },
    onError: (error: Error) => {
      toast({
        title: t.typing.errorSaving,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onComplete = useCallback(
    (stats: { wpm: number; accuracy: number; rawWpm: number; consistency: number; correctChars: number; incorrectChars: number }) => {
      import("react-ga4").then((ReactGA) => {
        ReactGA.default.event({
          category: "TypingTest",
          action: "completed",
          value: stats.wpm,
        });
      });

      if (user) {
        // Idempotency: har tugagan test uchun BIR MARTA UUID. react-query mutate
        // o'zgaruvchilarni saqlaydi — retry'da xuddi shu id yuboriladi (server no-op qiladi).
        resultMutation.mutate({
          wpm: stats.wpm,
          accuracy: stats.accuracy,
          rawWpm: stats.rawWpm,
          consistency: stats.consistency,
          language,
          mode: mode.toString(),
          clientResultId: makeClientResultId(),
        });
      }
    },
    [user, language, mode, resultMutation]
  );

  const {
    words,
    userInput,
    currentIndex,
    timeLeft,
    isActive,
    isFinished,
    stats,
    history,
    handleInputChange,
    handleGoBack,
    reset,
  } = useTypingTest({
    language,
    mode,
    onComplete,
  });

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div 
        className={`fixed inset-0 pointer-events-none transition-all duration-500 z-0 ${
          isActive && !isFinished 
            ? "opacity-100 bg-black/5 dark:bg-transparent" 
            : "opacity-0"
        }`} 
      />
      <div className="container relative z-10 mx-auto px-4 py-12 flex flex-col items-center min-h-[calc(100vh-8rem)]">
        {!isFinished ? (
          <>
          <div className="w-full flex flex-col items-center gap-4 mb-12">
            {/* FIX: Til va rejim selektorlari - faqat test boshlanmagan vaqtda ko'rinadi */}
            {/* Pastga tushish animatsiyasi bilan yashiriladi */}
            <div
              className={`flex flex-col items-center gap-4 overflow-hidden transition-opacity duration-300 ${
                isActive
                  ? "opacity-0 invisible pointer-events-none"
                  : "opacity-100 visible h-auto"
              }`}
            >
              <LanguageSelector currentLanguage={language} onLanguageChange={setLanguage} />
              <TimerModeSelector currentMode={mode} onModeChange={setMode} />
            </div>

            {/* FIX: Stats har doim ko'rinadi, lekin test boshlanmasa 0 turadi */}
            <StatsDisplay wpm={stats.wpm} accuracy={stats.accuracy} timeLeft={timeLeft} />
          </div>

          <TypingArea
            words={words}
            userInput={userInput}
            onInputChange={handleInputChange}
            onGoBack={handleGoBack}
            onRestart={reset}
            isActive={true}
            currentIndex={currentIndex}
            history={history}
          />

          {/* FIX: "Boshlash uchun yozing" matni faqat isActive=false da ko'rinadi */}
          <div
            className={`mt-8 transition-all duration-300 ${
              isActive ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <p className="text-muted-foreground font-mono animate-pulse">{t.typing.typeToStart}</p>
          </div>
        </>
      ) : (
        <div className="w-full animate-in zoom-in-95 duration-300">
          <ResultCard
            wpm={stats.wpm}
            accuracy={stats.accuracy}
            rawWpm={stats.rawWpm}
            consistency={stats.consistency}
            correctChars={stats.correctChars}
            incorrectChars={stats.incorrectChars}
            onRestart={reset}
          />
        </div>
      )}
      </div>
    </div>
  );
}
