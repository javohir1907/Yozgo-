import { useId } from "react";
import type { ReactElement } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  /** Receives the generated id, so the control is always programmatically labelled. */
  children: (props: { id: string; "aria-describedby"?: string }) => ReactElement;
  hint?: string;
  error?: string;
  className?: string;
}

/**
 * Generates the htmlFor/id pair automatically. Fixes the 26 fields across the
 * app (admin x10, auth x7, profile x4, battle x4, settings x1) that had a
 * <Label> with no htmlFor and an <Input> with no id — no field on the auth page
 * or the admin page was programmatically labelled.
 */
export function FormField({ label, children, hint, error, className }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
