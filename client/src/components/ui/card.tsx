import * as React from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Opts into the hover treatment. It used to be on the base class, so every
   * card in the app — including static stat tiles — highlighted on hover and
   * therefore looked clickable.
   */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Opaque bg. `dark:bg-card/60 dark:backdrop-blur-xl` cost a compositing
        // layer to blur an opaque --background behind it, i.e. nothing. Depth
        // comes from the --surface-1/2/3 scale instead.
        "rounded-xl border border-card-border bg-card text-card-foreground shadow-sm",
        "transition-[border-color,box-shadow] [transition-duration:var(--dur-fast)]",
        interactive && "hover:border-primary/40 hover:shadow-md",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      // text-2xl is a page-heading size, too loud inside a card — settings.tsx
      // and admin.tsx were both already overriding it back down to text-lg.
      className={cn(
        "font-heading text-lg font-bold leading-tight tracking-tight",
        className,
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
