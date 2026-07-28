import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // h-10 matches Button and SelectTrigger, so a form row lines up.
          "flex h-10 w-full rounded-md border-b-2 border-input bg-background/50 px-3 py-2",
          // text-base at every width: with maximum-scale=1 removed and a 16px
          // root, 16px is exactly what stops iOS zooming a focused input.
          "text-base placeholder:text-muted-foreground",
          "transition-[border-color,box-shadow] duration-[var(--dur-fast)]",
          // The underline style shipped with focus-visible:outline-none and no
          // replacement ring at all — a WCAG 2.4.7 failure. Keep the underline
          // aesthetic AND give focus a visible ring.
          "focus-visible:outline-none focus-visible:border-primary",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
