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
      language: string;
      mode: string;
    }) => {
      const res = await apiRequest("POST", "/api/results", result);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/results/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    },
    onError: (error: Error) => {
      toast({
        title: t.typing.errorSaving,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onComplete = useCallback((stats: {
    wpm: number;
    accuracy: number;
    correctChars: number;
    incorrectChars: number;
  }) => {
    import('react-ga4').then(ReactGA => {
      ReactGA.default.event({
        category: "TypingTest",
        action: "completed",
        value: stats.wpm
      });
    });

    if (user) {
      resultMutation.mutate({
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        language,
        mode: mode.toString(),
      });
    }
  }, [user, language, mode, resultMutation]);

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
    reset,
  } = useTypingTest({
    language,
    mode,
    onComplete,
  });

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center min-h-[calc(100vh-8rem)]">
      {!isFinished ? (
        <>
          <div className="w-full flex flex-col items-center gap-4 mb-12">

            {/* FIX: Til va rejim selektorlari - faqat test boshlanmagan vaqtda ko'rinadi */}
            {/* Pastga tushish animatsiyasi bilan yashiriladi */}
            <div
              className={`flex flex-col items-center gap-4 overflow-hidden transition-all duration-300 ease-in-out ${
                isActive
                  ? "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
                  : "max-h-40 opacity-100 translate-y-0"
              }`}
            >
              <LanguageSelector
                currentLanguage={language}
                onLanguageChange={setLanguage}
              />
              <TimerModeSelector
                currentMode={mode}
                onModeChange={setMode}
              />
            </div>

            {/* FIX: Stats har doim ko'rinadi, lekin test boshlanmasa 0 turadi */}
            <StatsDisplay
              wpm={stats.wpm}
              accuracy={stats.accuracy}
              timeLeft={timeLeft}
            />
          </div>

          <TypingArea
            words={words}
            userInput={userInput}
            onInputChange={handleInputChange}
            onComplete={reset}
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
            <p className="text-muted-foreground font-mono animate-pulse">
              {t.typing.typeToStart}
            </p>
          </div>
        </>
      ) : (
        <div className="w-full animate-in zoom-in-95 duration-300">
          <ResultCard
            wpm={stats.wpm}
            accuracy={stats.accuracy}
            correctChars={stats.correctChars}
            incorrectChars={stats.incorrectChars}
            onRestart={reset}
          />
        </div>
      )}
    </div>
  );
}
