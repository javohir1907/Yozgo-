import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  error?: unknown;
  /** Wired to a query's refetch. Without it the user's only option is F5. */
  onRetry?: () => void;
  title?: string;
  /** Tighter padding, for use inside a card or a tab panel. */
  compact?: boolean;
  className?: string;
}

function messageOf(error: unknown): string {
  if (!error) return "Noma'lum xato";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Noma'lum xato";
}

/**
 * Promoted from the local `ErrorBox` in admin.tsx — the only page in the app
 * that handled query errors at all — with the retry button it lacked.
 */
export function ErrorState({
  error,
  onRetry,
  title = "Yuklashda xatolik",
  compact,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        compact
          ? "rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6"
          : "min-h-[50vh] px-4 py-10",
        className,
      )}
    >
      <AlertTriangle
        className={cn("text-destructive", compact ? "h-6 w-6" : "h-9 w-9")}
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="font-medium text-destructive">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {messageOf(error)}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          Qayta urinish
        </Button>
      )}
    </div>
  );
}
