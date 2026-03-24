import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Keyboard, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const { login, register, isLoggingIn, isRegistering, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    if (isLogin || !firstName || firstName.trim() === "") {
      setIsUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || "";
        const res = await fetch(
          `${baseUrl}/api/auth/check-username?username=${encodeURIComponent(firstName.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setIsUsernameAvailable(data.available);
        }
      } catch (err) {
        console.error("Checking error", err);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [firstName, isLogin]);

  if (isAuthenticated) {
    const joinComp = sessionStorage.getItem("joinComp");
    if (joinComp) {
      sessionStorage.removeItem("joinComp");
      setLocation("/");
    } else {
      setLocation("/typing-test");
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        if (!firstName || firstName.length < 4) {
          setError(
            "Nickname faqat kichik harf va raqamlardan iborat bo'lishi kerak, kamida 4 ta belgi"
          );
          return;
        }
        await register({ email, password, firstName });
      }
      
      const joinComp = sessionStorage.getItem("joinComp");
      if (joinComp) {
        try {
          const { apiRequest } = await import("@/lib/queryClient");
          await apiRequest("POST", `/api/competitions/${joinComp}/register`);
        } catch(e) {}
        sessionStorage.removeItem("joinComp");
        setLocation("/"); // Return to landing showing waitlist update
      } else {
        setLocation("/typing-test");
      }
    } catch (err: any) {
      const body = err?.message || "Something went wrong";
      try {
        const parsed = JSON.parse(body.split(": ").slice(1).join(": "));
        const msg = parsed.message || body;
        if (msg.toLowerCase().includes("nik") || msg.toLowerCase().includes("username")) {
          setError(t.auth?.usernameExists || "This username is taken, please choose another.");
        } else {
          setError(msg);
        }
      } catch {
        setError(body);
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || "Xatolik! Ehtimol email topilmadi.");
        return;
      }
      setForgotSent(true);
    } catch(err) {
      alert("Tarmoq xatosi, API bilan bog'lanib bo'lmadi.");
    }
  };

  const isPending = isLoggingIn || isRegistering;

  if (showForgotPassword) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Keyboard className="w-8 h-8 text-primary" />
              <span className="font-bold text-2xl tracking-tighter">YOZGO</span>
            </div>
            <CardTitle>{t.auth?.forgotPassword || "Forgot password?"}</CardTitle>
          </CardHeader>
          <CardContent>
            {forgotSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-3xl">OK</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Agar hisob mavjud bo'lsa, tez orada ko'rsatmalar yuboriladi.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotSent(false);
                    setForgotEmail("");
                  }}
                >
                  {t.auth?.loginButton || "Sign In"}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">{t.auth?.email || "Email"}</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Yuborish
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Ortga qaytish
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Keyboard className="w-8 h-8 text-primary" />
            <span className="font-bold text-2xl tracking-tighter">YOZGO</span>
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
                <div className="relative">
                  <Input
                    id="firstName"
                    type="text"
                    placeholder={t.auth?.namePlaceholder || "Nickname (masalan: ali_99)"}
                    value={firstName}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                      setFirstName(val);
                    }}
                    required={!isLogin}
                    minLength={4}
                    maxLength={20}
                    data-testid="input-firstname"
                    className={
                      !isLogin && firstName
                        ? isUsernameAvailable === false
                          ? "border-red-500 focus-visible:ring-red-500 pr-8"
                          : isUsernameAvailable === true
                            ? "border-green-500 focus-visible:ring-green-500 pr-8"
                            : ""
                        : ""
                    }
                  />
                  {!isLogin && firstName && !isCheckingUsername && isUsernameAvailable === true && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none">
                      ✓
                    </div>
                  )}
                </div>
                {!isLogin && firstName && !isCheckingUsername && firstName.trim() !== "" && (
                  <p
                    className={`text-sm ${isUsernameAvailable === false ? "text-red-500" : "text-green-500"}`}
                  >
                    {isUsernameAvailable === false ? "Bu nom band, boshqa nom tanlang" : "✓ Mavjud"}
                  </p>
                )}
                {!isLogin && firstName && isCheckingUsername && (
                  <p className="text-sm text-yellow-500">Tekshirilmoqda...</p>
                )}
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.auth?.password || "Password"}</Label>
                {isLogin && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setShowForgotPassword(true)}
                    data-testid="button-forgot-password"
                  >
                    {t.auth?.forgotPassword || "Forgot password?"}
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="passwordholder"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div
                className="flex items-center gap-2 text-sm text-destructive"
                data-testid="text-auth-error"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
              data-testid="button-submit-auth"
            >
              {isPending
                ? isLogin
                  ? "Signing in..."
                  : "Creating account..."
                : isLogin
                  ? t.auth?.loginButton || "Sign In"
                  : t.auth?.registerButton || "Create Account"}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? (
              <span>
                {t.auth?.noAccount || "Don't have an account?"}{" "}
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                  }}
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
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                  }}
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
