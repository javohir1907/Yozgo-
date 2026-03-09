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
      userId?: string;
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

  const onComplete = useCallback((stats: { wpm: number; accuracy: number; correctChars: number; incorrectChars: number }) => {
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
    wordStatuses,
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
            {!isActive && (
              <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <LanguageSelector
                  currentLanguage={language}
                  onLanguageChange={setLanguage}
                />
                <TimerModeSelector
                  currentMode={mode}
                  onModeChange={setMode}
                />
              </div>
            )}
            
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
            wordStatuses={wordStatuses}
          />

          {!isActive && (
            <p className="mt-8 text-muted-foreground font-mono animate-pulse">
              {t.typing.typeToStart}
            </p>
          )}
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
