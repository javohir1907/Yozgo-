import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

export interface LoadingStateProps {
  size?: keyof typeof SIZES;
  /** Announced to screen readers; the spinner alone says nothing. */
  label?: string;
  /**
   * Reserves vertical space so swapping in the loaded content does not shift
   * the page. /leaderboard was the only page in the app that did this; it is
   * the default for everyone now.
   */
  minHeight?: string;
  /** Drops the centring wrapper, for use inside a button or a table cell. */
  inline?: boolean;
  className?: string;
}

/**
 * Promoted from the local `Spinner` in admin.tsx, which was the one place that
 * had bothered to make this a component. Six other sites copied the same JSX
 * at three different sizes and two container heights.
 */
export function LoadingState({
  size = "lg",
  label = "Yuklanmoqda…",
  minHeight = "min-h-[50vh]",
  inline,
  className,
}: LoadingStateProps) {
  const spinner = (
    <Loader2
      className={cn(SIZES[size], "animate-spin text-primary")}
      aria-hidden="true"
    />
  );

  if (inline) return spinner;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center", minHeight, className)}
    >
      {spinner}
      <span className="sr-only">{label}</span>
    </div>
  );
}
