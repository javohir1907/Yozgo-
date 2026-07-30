import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { key: string; text: string; gap: string; bump: string }> = {
  sm: { key: "w-6 h-6 rounded-[6px]", text: "text-[11px]", gap: "gap-1", bump: "h-[2px]" },
  md: { key: "w-8 h-8 rounded-md", text: "text-sm", gap: "gap-1.5", bump: "h-[2px]" },
  lg: { key: "w-10 h-10 rounded-lg", text: "text-base", gap: "gap-2", bump: "h-[3px]" },
};

export interface KeycapLogoProps {
  size?: Size;
  /** Set on the marketing/auth surfaces that want the wordmark to be the h1. */
  as?: "div" | "h1";
  className?: string;
}

/**
 * The YOZGO keycap wordmark. Was reimplemented inline in nav-header with
 * hardcoded hex shadows (dark:bg-[#28282b] etc.), and again as a plain
 * Keyboard icon + text in auth and reset-password. This is the single source.
 * The F/J-style homing bumps sit under the O and G, as on a real keyboard.
 */
export function KeycapLogo({ size = "md", as: Tag = "div", className }: KeycapLogoProps) {
  const s = SIZES[size];
  return (
    <Tag
      className={cn("flex items-center", s.gap, className)}
      aria-label="YOZGO"
    >
      {["Y", "O", "Z", "G", "O"].map((letter, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "relative flex select-none items-center justify-center border font-sans font-extrabold transition-transform duration-75",
            "bg-card text-card-foreground border-card-border shadow-[0_3px_0_hsl(var(--border))]",
            "hover:-translate-y-0.5 active:translate-y-0.5",
            s.key,
            s.text,
          )}
        >
          {letter}
          {(i === 1 || i === 3) && (
            <span
              className={cn(
                "absolute bottom-[15%] w-[30%] rounded-full bg-muted-foreground/50",
                s.bump,
              )}
            />
          )}
        </span>
      ))}
    </Tag>
  );
}
