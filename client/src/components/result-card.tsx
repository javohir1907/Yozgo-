import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Share2, Copy, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ResultCardProps {
  wpm: number;
  accuracy: number;
  rawWpm?: number;
  consistency?: number;
  correctChars: number;
  incorrectChars: number;
  /** Which test produced this — shown so a saved/shared result is identifiable. */
  language?: "en" | "ru" | "uz" | "kaa";
  mode?: number;
  onRestart: () => void;
}

export function ResultCard({
  wpm,
  accuracy,
  rawWpm,
  consistency,
  correctChars,
  incorrectChars,
  language,
  mode,
  onRestart,
}: ResultCardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const languageLabel = language
    ? {
        en: t.languages.english,
        ru: t.languages.russian,
        uz: t.languages.uzbek,
        kaa: t.languages.karakalpak,
      }[language]
    : undefined;

  const handleShare = async () => {
    const text = `YOZGO Typing Test Result:\n🚀 Speed: ${wpm} WPM\n🎯 Accuracy: ${accuracy}%\n📊 Raw WPM: ${rawWpm || 0}\n📈 Consistency: ${consistency || 0}%\n\nJoin the arena at yozgo.uz!`;
    try {
      // navigator.clipboard is undefined on insecure origins and rejects when
      // permission is denied — the old .then() with no .catch() left the button
      // silently dead. Fall back to execCommand, then surface a failure.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("copy failed");
      }
      setCopied(true);
      toast({ title: t.battle.copied, description: t.battle.copiedDesc });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: t.battle.copyFailed });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-none bg-transparent" data-testid="result-card">
      <CardHeader className="text-center p-0 mb-8">
        <CardTitle className="text-5xl font-mono text-primary mb-2">{t.typing.result}</CardTitle>
        {(language || mode) && (
          <div
            className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground"
            data-testid="result-test-meta"
          >
            {language && <span>{languageLabel}</span>}
            {language && mode ? <span className="opacity-40">·</span> : null}
            {mode && <span>{mode}s</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
              {t.typing.wpm}
            </p>
            <p className="text-5xl font-mono text-primary" data-testid="result-wpm">
              {wpm}
            </p>
          </div>
          <div className="text-center border-l border-border/10">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
              {t.typing.acc}
            </p>
            <p className="text-5xl font-mono text-primary" data-testid="result-accuracy">
              {accuracy}%
            </p>
          </div>
          <div className="text-center border-l border-border/10">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
              {t.typing.raw}
            </p>
            <p className="text-5xl font-mono text-muted-foreground/60 transition-colors hover:text-primary">
              {rawWpm || 0}
            </p>
          </div>
          <div className="text-center border-l border-border/10">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
              {t.typing.cons}
            </p>
            <p className="text-5xl font-mono text-muted-foreground/60 transition-colors hover:text-primary">
              {consistency || 0}%
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-12 mb-12 text-muted-foreground font-mono bg-secondary/20 py-4 rounded-3xl border border-border/5">
          <div className="text-center">
            <p className="text-[10px] uppercase mb-1 opacity-50">{t.typing.correct}</p>
            <p className="text-xl text-primary/80" data-testid="result-correct-chars">
              {correctChars}
            </p>
          </div>
          <div className="text-center border-l border-border/10 pl-12">
            <p className="text-[10px] uppercase mb-1 opacity-50">{t.typing.incorrect}</p>
            <p className="text-xl text-destructive/80" data-testid="result-incorrect-chars">
              {incorrectChars}
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant="ghost"
            onClick={onRestart}
            className="font-mono"
            data-testid="button-restart"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t.typing.restartTest}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="font-mono"
            data-testid="button-share"
            onClick={handleShare}
          >
            {copied ? <Check className="mr-2 h-4 w-4 text-success" /> : <Share2 className="mr-2 h-4 w-4" />}
            {t.typing.share}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
