import { Card } from "@/components/ui/card";

interface StatsDisplayProps {
  wpm: number;
  accuracy: number;
  timeLeft: number;
}

export function StatsDisplay({ wpm, accuracy, timeLeft }: StatsDisplayProps) {
  return (
    <div className="flex gap-8 justify-center items-center mb-8" data-testid="stats-display">
      <div className="text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Time</p>
        <p className="text-4xl font-mono text-primary" data-testid="text-timer">{timeLeft}s</p>
      </div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">WPM</p>
        <p className="text-4xl font-mono text-primary" data-testid="text-wpm">{wpm}</p>
      </div>
      <div className="text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Accuracy</p>
        <p className="text-4xl font-mono text-primary" data-testid="text-accuracy">{accuracy}%</p>
      </div>
    </div>
  );
}
