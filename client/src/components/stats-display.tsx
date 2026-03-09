import { useI18n } from "@/lib/i18n";

interface StatsDisplayProps {
  wpm: number;
  accuracy: number;
  timeLeft: number;
}

export function StatsDisplay({ wpm, accuracy, timeLeft }: StatsDisplayProps) {
  const { t } = useI18n();

  return (
    <div className="flex gap-8 justify-center items-center mb-8" data-testid="stats-display">
      <div className="text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">{t.typing.time}</p>
        <p className="text-4xl font-mono text-primary" data-testid="text-timer">{timeLeft}s</p>
      </div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">WPM</p>
        <p className="text-4xl font-mono text-primary" data-testid="text-wpm">{wpm}</p>
      </div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">{t.typing.accuracy}</p>
        <p className="text-4xl font-mono text-primary" data-testid="text-accuracy">{accuracy}%</p>
      </div>
    </div>
  );
}
