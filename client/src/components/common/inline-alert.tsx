import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-info/30 bg-info/10 text-info", Icon: Info },
  success: { cls: "border-success/30 bg-success/10 text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning/30 bg-warning/10 text-warning", Icon: TriangleAlert },
  danger: { cls: "border-destructive/30 bg-destructive/10 text-destructive", Icon: AlertCircle },
};

export interface InlineAlertProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

/**
 * Promoted from auth.tsx's `errorLine`. An inline, non-toast message strip for
 * form errors and the like (reset-password's error box, the quests unlock
 * banner). role=alert only on danger, so a success message is not announced as
 * an error.
 */
export function InlineAlert({ tone = "danger", children, className }: InlineAlertProps) {
  const { cls, Icon } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        cls,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-foreground">{children}</span>
    </div>
  );
}
