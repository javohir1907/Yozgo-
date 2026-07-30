import { Link } from "wouter";
import { LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/loading-state";

export interface AuthGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * Gates a page behind authentication. Replaces six divergent implementations:
 * four bare copies (one of which dropped the h1), battle's richer version (the
 * only one that offered a way to log in — now the standard), and admin's
 * redirect. Also ends the abuse of t.leaderboard.leagueEmpty as the generic
 * "you must log in" string on three unrelated pages.
 */
export function AuthGate({ children, title, description }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) return <LoadingState />;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LogIn className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold">
            {title ?? t.auth.login}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {description ?? t.auth.loginDesc}
          </p>
        </div>
        <Button asChild>
          <Link href="/auth">
            <LogIn aria-hidden="true" />
            {t.nav.signIn}
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
