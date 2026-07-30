import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Right-aligned slot: e.g. the shop's coin counter, a filter, an action. */
  actions?: ReactNode;
  align?: "start" | "center";
  className?: string;
}

/**
 * The one page-heading component. Replaces eight hand-rolled implementations
 * that used four different h1 sizes (text-2xl/3xl/4xl/6xl), three wrapper
 * elements (header/div/motion.div), and left three pages with no h1 at all.
 * The h1 size is fixed here so it cannot drift again.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  align = "start",
  className,
}: PageHeaderProps) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex gap-4",
        centered
          ? "flex-col items-center text-center"
          : "flex-col items-start sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div
        className={cn(
          "flex gap-3",
          centered ? "flex-col items-center" : "items-center",
        )}
      >
        {Icon && (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl bg-muted text-foreground",
              centered ? "h-14 w-14" : "h-11 w-11",
            )}
          >
            <Icon className={centered ? "h-7 w-7" : "h-6 w-6"} aria-hidden="true" />
          </span>
        )}
        <div className="space-y-1">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
