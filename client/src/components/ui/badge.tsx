import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Badges should never wrap.
  [
    "whitespace-nowrap inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5",
    "text-xs font-semibold transition-colors [transition-duration:var(--dur-fast)]",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    "[&_svg]:size-3 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      // `shadow-xs` used to be on three of these — that is a Tailwind v4 class
      // name, and this project runs v3.4, so it emitted nothing at all.
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-info text-info-foreground",
        // Subtle tinted variants, for the many places pages hardcoded
        // bg-blue-500/10 text-blue-500 and friends.
        "soft-primary": "border-primary/25 bg-primary/10 text-primary",
        "soft-success": "border-success/25 bg-success/10 text-success",
        "soft-warning": "border-warning/25 bg-warning/10 text-warning",
        "soft-destructive":
          "border-destructive/25 bg-destructive/10 text-destructive",
        "soft-info": "border-info/25 bg-info/10 text-info",
        // Was [border-color:var(--badge-outline)] — a variable that was never
        // defined anywhere, so the border fell back to currentColor.
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
