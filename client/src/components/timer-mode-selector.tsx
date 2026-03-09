import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TimerMode = 15 | 30 | 60;

interface TimerModeSelectorProps {
  currentMode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
}

export function TimerModeSelector({ currentMode, onModeChange }: TimerModeSelectorProps) {
  const modes: TimerMode[] = [15, 30, 60];

  return (
    <div className="flex gap-2 justify-center mb-8" data-testid="timer-mode-selector">
      {modes.map((mode) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs font-mono transition-all",
            currentMode === mode ? "text-primary bg-muted" : "text-muted-foreground hover:text-primary"
          )}
          onClick={() => onModeChange(mode)}
          data-testid={`button-mode-${mode}`}
        >
          {mode}s
        </Button>
      ))}
    </div>
  );
}
