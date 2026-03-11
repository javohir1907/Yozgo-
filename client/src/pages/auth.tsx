import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Keyboard, AlertCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");
  const { login, register, isLoggingIn, isRegistering, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  if (isAuthenticated) {
    setLocation("/typing-test");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await register({ email, password, firstName: firstName || undefined });
      }
      setLocation("/typing-test");
    } catch (err: any) {
      const body = err?.message || "Something went wrong";
      try {
        const parsed = JSON.parse(body.split(": ").slice(1).join(": "));
        setError(parsed.message || body);
      } catch {
        setError(body);
      }
    }
  };

  const isPending = isLoggingIn || isRegistering;

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/logo.png" alt="YOZGO Logo" className="h-10 object-contain" />
          </div>
          <CardTitle data-testid="text-auth-title">
            {isLogin ? t.auth?.login || "Sign In" : t.auth?.register || "Create Account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? t.auth?.loginDesc || "Sign in to track your progress"
              : t.auth?.registerDesc || "Create an account to save your results"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="firstName">{t.auth?.name || "Name"}</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder={t.auth?.namePlaceholder || "Your name (optional)"}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-firstname"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth?.email || "Email"}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth?.password || "Password"}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive" data-testid="text-auth-error">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-auth">
              {isPending
                ? (isLogin ? "Signing in..." : "Creating account...")
                : (isLogin ? t.auth?.loginButton || "Sign In" : t.auth?.registerButton || "Create Account")}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? (
              <span>
                {t.auth?.noAccount || "Don't have an account?"}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={() => { setIsLogin(false); setError(""); }}
                  data-testid="button-switch-register"
                >
                  {t.auth?.registerLink || "Sign up"}
                </button>
              </span>
            ) : (
              <span>
                {t.auth?.hasAccount || "Already have an account?"}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={() => { setIsLogin(true); setError(""); }}
                  data-testid="button-switch-login"
                >
                  {t.auth?.loginLink || "Sign in"}
                </button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
