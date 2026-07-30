import { cn } from "@/lib/utils";

/**
 * A shimmer sweep reads as "loading" more clearly than a pulse, and the
 * keyframe was already sitting unused in tailwind.config.ts. The sweep is
 * suppressed under prefers-reduced-motion, where the flat muted block is
 * still a perfectly good placeholder.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "motion-safe:after:absolute motion-safe:after:inset-0",
        "motion-safe:after:-translate-x-full motion-safe:after:animate-shimmer",
        "motion-safe:after:bg-gradient-to-r motion-safe:after:from-transparent motion-safe:after:via-foreground/[0.07] motion-safe:after:to-transparent",
        "motion-reduce:animate-pulse",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
