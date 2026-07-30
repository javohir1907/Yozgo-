import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * Promoted from admin.tsx's EmptyBox (a bare centred string), upgraded to the
 * richer dashed-card shape leaderboard.tsx had hand-rolled. Also covers the
 * empty branches in league and friends.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/20 text-center",
        compact ? "gap-2 px-4 py-10" : "gap-3 px-4 py-20",
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn("text-muted-foreground/30", compact ? "h-8 w-8" : "h-12 w-12")}
          aria-hidden="true"
        />
      )}
      <p className={cn("font-medium text-foreground", compact ? "text-base" : "text-lg")}>
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
