import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeycapLogo } from "@/components/brand/keycap-logo";

export interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * The centered auth shell. Promoted from auth.tsx's module-level `Shell` (kept
 * at module scope there to avoid remounting inputs and losing focus) and its
 * line-for-line duplicate in reset-password. Uses the KeycapLogo wordmark
 * instead of the Keyboard-icon + text lockup.
 */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <KeycapLogo size="md" className="mb-3" />
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
