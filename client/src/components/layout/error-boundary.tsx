import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IS_DEV } from "@/lib/env";

type FallbackRender = (args: {
  error: Error;
  reset: () => void;
}) => React.ReactNode;

interface Props {
  children: React.ReactNode;
  /** Custom fallback. Receives the error and a reset callback. */
  fallback?: FallbackRender;
  /** Changing any value in this array resets the boundary (e.g. [location]). */
  resetKeys?: unknown[];
  /** Reported alongside the error so we can tell root/route/chart apart. */
  scope?: string;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * The app had no error boundary at all, so any render throw — including a
 * failed lazy chunk fetch — unmounted the whole tree to a blank screen.
 * Mounted at three levels: root (main.tsx), per-route (App.tsx, keyed on
 * location), and around ProgressChart, which Recharts can throw from on
 * malformed data.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep this cheap and dependency-free; Sentry is server-side only today.
    console.error(
      `[error-boundary${this.props.scope ? `:${this.props.scope}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(prev: Props) {
    if (!this.state.error) return;
    const a = prev.resetKeys;
    const b = this.props.resetKeys;
    if (!a || !b) return;
    if (a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))) {
      this.reset();
    }
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }

    return <DefaultErrorFallback error={error} reset={this.reset} />;
  }
}

/**
 * Deliberately not localised: the root instance renders outside I18nProvider,
 * and a boundary that throws while reading a broken context is worse than an
 * untranslated one. Route-level instances pass a localised `fallback`.
 */
export function DefaultErrorFallback({
  error,
  reset,
  compact,
}: {
  error: Error;
  reset: () => void;
  compact?: boolean;
}) {
  const isChunkError =
    /Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
      error.message,
    );

  return (
    <div
      role="alert"
      className={
        compact
          ? "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
          : "flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
      }
    >
      <AlertTriangle
        className="h-10 w-10 text-destructive"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-lg font-bold">Nimadir xato ketdi</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {isChunkError
            ? "Sahifa yuklanmadi. Tarmoqni tekshirib, qayta urinib ko'ring."
            : "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={isChunkError ? () => window.location.reload() : reset}>
          <RotateCcw aria-hidden="true" />
          Qayta urinish
        </Button>
      </div>
      {IS_DEV && (
        <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.stack ?? error.message}
        </pre>
      )}
    </div>
  );
}
