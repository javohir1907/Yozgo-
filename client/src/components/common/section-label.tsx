import { cn } from "@/lib/utils";

/**
 * The small uppercase eyebrow label used above list sections and stat groups
 * (friends section headers, the battle/result-card micro-labels). Was a
 * repeated `text-[10px] uppercase tracking-widest` string.
 */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-2xs font-bold uppercase tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
