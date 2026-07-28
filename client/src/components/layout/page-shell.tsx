import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import SEO from "@/components/SEO";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl" | "full";
type Gap = "tight" | "normal" | "loose";

const MAX_WIDTH: Record<Size, string> = {
  sm: "max-w-2xl", // 42rem — auth-style single column
  md: "max-w-3xl", // 48rem — quests, shop, league, friends
  lg: "max-w-5xl", // 64rem — admin, profile
  xl: "max-w-6xl", // 72rem — leaderboard, battle arena
  full: "max-w-none",
};

const GAP: Record<Gap, string> = {
  tight: "space-y-4",
  normal: "space-y-6",
  loose: "space-y-8",
};

export interface PageShellProps {
  children: ReactNode;
  /** Content max-width. Replaces the four ad-hoc max-w values in circulation. */
  size?: Size;
  gap?: Gap;
  /** When any of these is set, a PageHeader is rendered above the children. */
  title?: string;
  description?: ReactNode;
  icon?: LucideIcon;
  headerAlign?: "start" | "center";
  headerActions?: ReactNode;
  /** When set, emits a <SEO> tag. */
  seo?: { title?: string; description?: string; noindex?: boolean };
  className?: string;
}

/**
 * The single page container. Replaces nine distinct container recipes across
 * the pages — different max-widths, paddings, and an `animate-in fade-in` that
 * five pages had and nine did not. `flex-1` lets it fill the flex column in
 * App.tsx so no page needs the (wrong) min-h-[calc(100vh-8rem)] magic number.
 */
export function PageShell({
  children,
  size = "md",
  gap = "normal",
  title,
  description,
  icon,
  headerAlign,
  headerActions,
  seo,
  className,
}: PageShellProps) {
  return (
    <div className="flex-1 py-6 sm:py-8 lg:py-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {seo && (
        <SEO title={seo.title} description={seo.description} />
      )}
      <div className={cn("container mx-auto px-4", MAX_WIDTH[size], GAP[gap], className)}>
        {title && (
          <PageHeader
            title={title}
            description={description}
            icon={icon}
            align={headerAlign}
            actions={headerActions}
          />
        )}
        {children}
      </div>
    </div>
  );
}
