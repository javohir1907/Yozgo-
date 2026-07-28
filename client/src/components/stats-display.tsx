import { useI18n } from "@/lib/i18n";

interface StatsDisplayProps {
  wpm: number;
  accuracy: number;
  timeLeft: number;
}

export function StatsDisplay({ wpm, accuracy, timeLeft }: StatsDisplayProps) {
  const { t } = useI18n();

  return (
    <div
      className="mb-8 flex items-center justify-center gap-6 sm:gap-10"
      data-testid="stats-display"
    >
      <Stat label={t.typing.time} value={`${timeLeft}s`} srUnit="seconds left" testId="text-timer" />
      <Stat label={t.typing.wpm} value={wpm} srUnit="words per minute" testId="text-wpm" live />
      <Stat label={t.typing.accuracy} value={`${accuracy}%`} srUnit="percent accuracy" testId="text-accuracy" live />
    </div>
  );
}

function Stat({
  label,
  value,
  srUnit,
  testId,
  live,
}: {
  label: string;
  value: React.ReactNode;
  srUnit: string;
  testId: string;
  live?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="mb-1 text-2xs font-bold uppercase tracking-widest text-muted-foreground sm:text-sm">
        {label}
      </p>
      <p
        className="text-4xl font-mono font-bold tabular-nums text-primary"
        data-testid={testId}
        aria-live={live ? "polite" : undefined}
        aria-atomic={live ? true : undefined}
      >
        {value}
        <span className="sr-only"> {srUnit}</span>
      </p>
    </div>
  );
}
