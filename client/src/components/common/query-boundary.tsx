import type { ReactNode } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";

/** The subset of a TanStack Query result this needs. */
export interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch?: () => unknown;
}

export interface QueryBoundaryProps {
  query: QueryLike;
  /** When true (and not loading/error), the empty branch renders. */
  isEmpty?: boolean;
  children: ReactNode;
  /** Overrides the default centred spinner. */
  loading?: ReactNode;
  /** Overrides the default ErrorState. */
  error?: ReactNode;
  /** Shown when isEmpty. */
  empty?: ReactNode;
}

/**
 * The highest-value primitive in the redesign. Four pages gated on
 * `if (isLoading || !data)` and had no error branch at all, so a failed request
 * spun forever; profile did the same around a skeleton, so a failure rendered a
 * permanent fake skeleton. Routing every query through this makes the error
 * branch impossible to forget — isError is checked before the empty and success
 * branches, and ErrorState is wired to refetch.
 */
export function QueryBoundary({
  query,
  isEmpty,
  children,
  loading,
  error,
  empty,
}: QueryBoundaryProps) {
  if (query.isError) {
    return (
      <>
        {error ?? (
          <ErrorState
            error={query.error}
            onRetry={query.refetch ? () => query.refetch!() : undefined}
          />
        )}
      </>
    );
  }
  if (query.isLoading) {
    return <>{loading ?? <LoadingState />}</>;
  }
  if (isEmpty) {
    return <>{empty ?? null}</>;
  }
  return <>{children}</>;
}
