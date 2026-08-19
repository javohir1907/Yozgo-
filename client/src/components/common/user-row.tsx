import { Link } from "wouter";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { frameRingStyle, type FrameMeta } from "@/lib/frame";

export interface UserRowUser {
  id?: string | number;
  username: string;
  avatarUrl?: string | null;
  /** Cosmetic frame bought in the shop — visible to everyone, not just the owner. */
  frameMeta?: FrameMeta | null;
}

export interface UserRowProps {
  user: UserRowUser;
  /** Leading rank number / medal. */
  rank?: ReactNode;
  /** Trailing content: score, XP, actions. */
  trailing?: ReactNode;
  /** Wraps the row in a link to the profile. */
  href?: string;
  /** Highlights the current user's own row. */
  highlight?: boolean;
  size?: "sm" | "md";
  presence?: "online" | "offline";
  className?: string;
}

/**
 * The avatar + name row, unifying four implementations (league, friends,
 * leaderboard-table, and battle — which used a raw <img> with no alt). Always
 * uses the Avatar primitive and always passes an alt.
 */
export function UserRow({
  user,
  rank,
  trailing,
  href,
  highlight,
  size = "md",
  presence,
  className,
}: UserRowProps) {
  const avatarSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const initials = user.username.slice(0, 2).toUpperCase();

  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        highlight && "bg-primary/10",
        className,
      )}
    >
      {rank != null && (
        <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
          {rank}
        </span>
      )}
      <div className="relative shrink-0">
        <Avatar className={avatarSize} style={frameRingStyle(user.frameMeta, 2)}>
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.username} />
          <AvatarFallback className="bg-primary/10 text-xs text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        {presence && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
              presence === "online" ? "bg-success" : "bg-muted-foreground/40",
            )}
            aria-label={presence === "online" ? "online" : "offline"}
          />
        )}
      </div>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-medium",
          highlight && "font-bold text-primary",
        )}
      >
        {user.username}
      </span>
      {trailing != null && <div className="shrink-0">{trailing}</div>}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-md transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
