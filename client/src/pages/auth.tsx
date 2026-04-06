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

  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [googleOtpEmail, setGoogleOtpEmail] = useState("");

  const { login, register, isLoggingIn, isRegistering, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const gEmail = searchParams.get("googleOtpEmail");
    if (gEmail) {
      setGoogleOtpEmail(gEmail);
      setShowOtp(true);
    }
  }, []);

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
        
        const joinComp = sessionStorage.getItem("joinComp");
        if (joinComp) {
          try {
            const { apiRequest } = await import("@/lib/queryClient");
            await apiRequest("POST", `/api/competitions/${joinComp}/register`);
          } catch(e) {}
          sessionStorage.removeItem("joinComp");
          setLocation("/");
        } else {
          setLocation("/typing-test");
        }
      } else {
        if (!firstName || firstName.length < 4) {
          setError("Nickname faqat kichik harf va raqamlardan iborat bo'lishi kerak, kamida 4 ta belgi");
          return;
        }
        
        // Send OTP first
        setIsCheckingUsername(true);
        const baseUrl = import.meta.env.VITE_API_URL || "";
        const res = await fetch(`${baseUrl}/api/auth/send-register-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, firstName })
        });
        setIsCheckingUsername(false);
        if (!res.ok) {
          const data = await res.json().catch(()=>({}));
          throw new Error(data.message || "Xatolik yuz berdi");
        }
        setShowOtp(true);
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (googleOtpEmail) {
        const baseUrl = import.meta.env.VITE_API_URL || "";
        const res = await fetch(`${baseUrl}/api/auth/google-verify`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ email: googleOtpEmail, otp: otpCode })
        });
        if (!res.ok) {
           const data = await res.json().catch(()=>({}));
           throw new Error(data.message || "Kod xato");
        }
        window.location.href = "/typing-test";
      } else {
        await register({ email, password, firstName, otp: otpCode });
        
        const joinComp = sessionStorage.getItem("joinComp");
        if (joinComp) {
          try {
            const { apiRequest } = await import("@/lib/queryClient");
            await apiRequest("POST", `/api/competitions/${joinComp}/register`);
          } catch(e) {}
          sessionStorage.removeItem("joinComp");
          setLocation("/");
        } else {
          setLocation("/typing-test");
        }
      }
    } catch(err: any) {
      const body = err?.message || "Xatolik";
      try {
        const parsed = JSON.parse(body.split(": ").slice(1).join(": "));
        setError(parsed.message || body);
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

  if (showOtp) {
    return (
      <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Keyboard className="w-8 h-8 text-primary" />
              <span className="font-bold text-2xl tracking-tighter">YOZGO</span>
            </div>
            <CardTitle>Emailni tasdiqlash</CardTitle>
            <CardDescription>
              {googleOtpEmail ? googleOtpEmail : email} manziliga yuborilgan kodni kiriting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Tasdiqlash kodi</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Kodni kiriting (6 xonali)"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  className="text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isRegistering}>
                {isRegistering ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setShowOtp(false);
                  setGoogleOtpEmail("");
                }}
              >
                Ortga qaytish
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Yoki orqali davom etish</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full bg-white hover:bg-gray-50 text-gray-900 border-gray-200"
              onClick={() => {
                const baseUrl = import.meta.env.VITE_API_URL || "";
                window.location.href = `${baseUrl}/api/auth/google`;
              }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google orqali {isLogin ? "kirish" : "ro'yxatdan o'tish"}
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
