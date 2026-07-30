import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "default" | "brand" | "success" | "warning" | "danger" | "info";
type Size = "sm" | "md" | "lg";

// Tone tints ONLY the icon tile — never the value. Default is a NEUTRAL tile;
// orange is reserved for `brand` (used sparingly), so a grid of stat cards
// isn't a wall of orange. The value is always foreground.
const TILE: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  brand: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
};

const VALUE_SIZE: Record<Size, string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-stat",
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
 * The one stat tile. Elevated card with a subtle top-lit gradient and a filled
 * icon tile, so it reads as a designed surface rather than a flat bordered box.
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
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-card-border p-5",
        "bg-gradient-to-br from-card to-card-border/25",
        "shadow-sm transition-[transform,box-shadow,border-color] duration-200",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      {/* faint brand wash in the corner for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/[0.06] blur-2xl transition-opacity duration-200 group-hover:opacity-80"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-24" />
          ) : (
            <p
              className={cn(
                "mt-2 font-mono font-extrabold tabular-nums leading-none text-foreground",
                VALUE_SIZE[size],
              )}
              aria-live={live ? "polite" : undefined}
              aria-atomic={live ? true : undefined}
            >
              {value}
            </p>
          )}
          {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              TILE[tone],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
