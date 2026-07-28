import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "default" | "brand" | "success" | "warning" | "danger" | "info";
type Size = "sm" | "md" | "lg";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-foreground",
  brand: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

const VALUE_SIZE: Record<Size, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-stat", // clamp(2rem,5vw,3rem) — the shared big-number size
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  loading?: boolean;
  size?: Size;
  /** Announces value changes politely — used by the live WPM/accuracy readout. */
  live?: boolean;
  className?: string;
}

/**
 * The one stat tile. Replaces six independent implementations with six
 * different value typographies (profile, admin x2, battle x2, stats-display,
 * result-card). The value uses font-mono because these are almost always
 * numbers, and `live` supplies the aria-live that the typing readout lacked.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  loading,
  size = "md",
  live,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className={cn("h-4 w-4", TONE_TEXT[tone])} aria-hidden="true" />}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-9 w-20" />
      ) : (
        <p
          className={cn(
            "mt-1 font-mono font-bold tabular-nums leading-none",
            VALUE_SIZE[size],
            TONE_TEXT[tone],
          )}
          aria-live={live ? "polite" : undefined}
          aria-atomic={live ? true : undefined}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
