import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, CheckCircle2, Mail } from "lucide-react";
import { normalizeUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AuthCard } from "@/components/layout/auth-card";
import { PasswordField } from "@/components/common/password-field";
import { InlineAlert } from "@/components/common/inline-alert";
import SEO from "@/components/SEO";

// apiRequest xatolari "NNN: <xabar>" ko'rinishida keladi (throwIfResNotOk) — status
// prefiksini olib tashlab toza xabarni qaytaramiz. Xabar JSON bo'lsa .message olamiz.
function extractMsg(err: any): string {
  const b = String(err?.message || "Xatolik yuz berdi");
  const m = b.match(/^\d{3}:\s*([\s\S]*)$/);
  const rest = (m ? m[1] : b).trim() || "Xatolik yuz berdi";
  try {
    const j = JSON.parse(rest);
    return j.message || rest;
  } catch {
    return rest;
  }
}

// Telegram bloki: bot ochish + kod kiritish. onVerify berilsa (register) alohida
// "Tasdiqlash" tugmasi va verified holati ko'rsatiladi; berilmasa (login) faqat input.
function TelegramBlock({
  tgToken,
  tgDeepLink,
  tgBound,
  tgCode,
  setTgCode,
  busy,
  onStart,
  verified,
  verifying,
  onVerify,
}: {
  tgToken: string;
  tgDeepLink: string;
  tgBound: boolean;
  tgCode: string;
  setTgCode: (v: string) => void;
  busy: boolean;
  onStart: () => void;
  verified?: boolean;
  verifying?: boolean;
  onVerify?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><Send className="w-4 h-4 text-info" /> Telegram tasdiqlash</Label>
        {verified ? (
          <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Tasdiqlandi</span>
        ) : tgBound ? (
          <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Ulandi</span>
        ) : null}
      </div>
      {!verified && (
        <Button type="button" variant="outline" className="w-full" onClick={onStart} disabled={busy}>
          <Send className="w-4 h-4 mr-2" /> {tgToken ? "Botni qayta ochish" : "Telegram botni ochish"}
        </Button>
      )}
      {tgDeepLink && !verified && (
        // window.open fetch'dan KEYIN chaqirilgani uchun Safari popup-blocker uni
        // bloklashi mumkin — to'g'ridan-to'g'ri bosiladigan havola har doim ishlaydi.
        <a href={tgDeepLink} target="_blank" rel="noreferrer" className="block text-center text-xs text-primary hover:underline">
          Bot ochilmadimi? Shu havolani bosing
        </a>
      )}
      <p className="text-xs text-muted-foreground">
        Bot ochilib <b>Start</b> bosing → telefon raqamingizni yuboring (tugma orqali) → bot 6 xonali kodni yuboradi → shu yerga kiriting.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Telegram kodi (6 xonali)"
          value={tgCode}
          onChange={(e) => setTgCode(e.target.value)}
          maxLength={6}
          className="text-center tracking-widest"
          disabled={verified}
        />
        {onVerify && (
          <Button type="button" onClick={onVerify} disabled={verified || verifying || busy || tgCode.length < 6}>
            {verifying ? "..." : "Tasdiqlash"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { login, register, loginTelegram, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginTab, setLoginTab] = useState<"password" | "telegram">("password");
  const [regStep, setRegStep] = useState<"form" | "verify">("form");

  // Register / shared form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");

  // Login (password) — email yoki username
  const [loginId, setLoginId] = useState("");

  // Kodlar va kanal holatlari
  const [emailCode, setEmailCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailToken, setEmailToken] = useState(""); // verify-email qaytargan bir martalik isbot
  const [tgToken, setTgToken] = useState("");
  const [tgDeepLink, setTgDeepLink] = useState("");
  const [tgCode, setTgCode] = useState("");
  const [tgBound, setTgBound] = useState(false);
  const [tgVerified, setTgVerified] = useState(false);
  const [tgVerifying, setTgVerifying] = useState(false);

  // Username bandligi
  const [usernameFree, setUsernameFree] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Username availability (register form)
  useEffect(() => {
    if (mode !== "register" || !username) {
      setUsernameFree(null);
      return;
    }
    setCheckingUsername(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(normalizeUrl(`/api/auth/check-username?username=${encodeURIComponent(username)}`));
        if (res.ok) setUsernameFree((await res.json()).available);
      } catch { /* ignore */ } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [username, mode]);

  // Telegram bog'lanish holatini poll qilish (Start + telefon yuborildimi?)
  useEffect(() => {
    if (!tgToken || tgBound) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(normalizeUrl(`/api/auth/telegram/status?token=${tgToken}`));
        const d = await r.json();
        if (d.bound) setTgBound(true);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(iv);
  }, [tgToken, tgBound]);

  // Was calling setLocation during render (a state update mid-render). Redirect
  // in an effect instead.
  useEffect(() => {
    if (!isAuthenticated) return;
    const joinComp = sessionStorage.getItem("joinComp");
    if (joinComp) {
      sessionStorage.removeItem("joinComp");
      setLocation("/");
    } else {
      setLocation("/typing-test");
    }
  }, [isAuthenticated, setLocation]);

  if (isAuthenticated) return null;

  const afterAuth = async () => {
    const joinComp = sessionStorage.getItem("joinComp");
    if (joinComp) {
      try {
        const { apiRequest } = await import("@/lib/queryClient");
        await apiRequest("POST", `/api/competitions/${joinComp}/register`);
      } catch { /* ignore */ }
      sessionStorage.removeItem("joinComp");
      setLocation("/");
    } else {
      setLocation("/typing-test");
    }
  };

  // Telegram deep-link yaratish (register yoki login). Yangi token = eski jarayon
  // bekor — bog'lanish/tasdiq holatlari reset qilinadi.
  async function startTelegram(purpose: "register" | "login") {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(normalizeUrl(`/api/auth/telegram/start`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Telegram ulanishida xatolik");
      setTgToken(d.token);
      setTgDeepLink(d.deepLink);
      setTgBound(false);
      setTgVerified(false);
      setTgCode("");
      // Safari'da fetch'dan keyingi window.open bloklanishi mumkin — UI'da anchor
      // fallback havola ham ko'rsatiladi (TelegramBlock).
      window.open(d.deepLink, "_blank");
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  // Register 1-qadam: email OTP + Telegram token
  async function submitRegisterForm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (username.length < 4) { setError("Username kamida 4 belgi (kichik harf/raqam/_)."); return; }
    if (usernameFree === false) { setError("Bu username band, boshqasini tanlang."); return; }
    if (password.length < 6) { setError("Parol kamida 6 belgi."); return; }
    setBusy(true);
    try {
      const res = await fetch(normalizeUrl(`/api/auth/register/email-otp`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Email kodini yuborishda xatolik");
      setEmailVerified(false);
      setEmailCode("");
      setEmailToken("");
      await startTelegram("register");
      setRegStep("verify");
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  // Email kodini qayta yuborish — server eski qatorlarni (verified bo'lsa ham) o'chiradi.
  async function resendEmailCode() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(normalizeUrl(`/api/auth/register/email-otp`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Email kodini yuborishda xatolik");
      setEmailVerified(false);
      setEmailCode("");
      setEmailToken("");
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  // Email kanalini alohida tasdiqlash
  async function verifyEmail() {
    setError("");
    setEmailVerifying(true);
    try {
      const res = await fetch(normalizeUrl(`/api/auth/register/verify-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: emailCode }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Email kodini tasdiqlashda xatolik");
      setEmailVerified(true);
      setEmailToken(d.emailToken || "");
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setEmailVerifying(false);
    }
  }

  // Telegram kanalini alohida tasdiqlash
  async function verifyTelegram() {
    setError("");
    setTgVerifying(true);
    try {
      const res = await fetch(normalizeUrl(`/api/auth/register/verify-telegram`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tgToken, code: tgCode }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Telegram kodini tasdiqlashda xatolik");
      setTgVerified(true);
    } catch (e: any) {
      setError(e.message || "Xatolik");
    } finally {
      setTgVerifying(false);
    }
  }

  // Register 2-qadam: ikkala kanal tasdiqlangach yakuniy ro'yxat
  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!emailVerified || !emailToken) { setError("Email tasdiqlanmagan. Avval email kodini tasdiqlang."); return; }
    if (!tgVerified) { setError("Telegram tasdiqlanmagan. Avval Telegram kodini tasdiqlang."); return; }
    setBusy(true);
    try {
      await register({ username, email, password, gender, emailToken, telegramToken: tgToken });
      await afterAuth();
    } catch (e: any) {
      setError(extractMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitLoginPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login({ emailOrUsername: loginId, password });
      await afterAuth();
    } catch (e: any) {
      setError(extractMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitLoginTelegram(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginTelegram({ token: tgToken, code: tgCode });
      await afterAuth();
    } catch (e: any) {
      setError(extractMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(normalizeUrl(`/api/auth/forgot-password`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || "Xatolik"); return; }
      setForgotSent(true);
    } catch {
      setError("Tarmoq xatosi");
    }
  }

  const errorLine = error ? <InlineAlert tone="danger">{error}</InlineAlert> : null;

  // ---------- Forgot password ----------
  if (showForgot) {
    return (
      <AuthCard title="Parolni tiklash">
        {forgotSent ? (
          <div className="text-center space-y-4">
            <Mail className="w-12 h-12 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Agar hisob mavjud bo'lsa, ko'rsatmalar emailingizga yuboriladi.</p>
            <Button className="w-full" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}>Ortga</Button>
          </div>
        ) : (
          <form onSubmit={submitForgot} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input id="forgot-email" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            </div>
            {errorLine}
            <Button type="submit" className="w-full">Yuborish</Button>
            <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowForgot(false)}>Ortga</button>
          </form>
        )}
      </AuthCard>
    );
  }

  // ---------- Register: verify step (har kanal ALOHIDA tasdiqlanadi) ----------
  if (mode === "register" && regStep === "verify") {
    return (
      <AuthCard title="Ikki tasdiq" description="Email VA Telegram — ikkalasi ham tasdiqlanishi shart">
        <form onSubmit={submitRegister} className="space-y-4">
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1"><Mail className="w-4 h-4 text-primary" /> Email kodi</Label>
              {emailVerified && (
                <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Tasdiqlandi</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{email} manziliga yuborilgan 6 xonali kod.</p>
            <div className="flex gap-2">
              <Input
                placeholder="Email kodi"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                maxLength={6}
                className="text-center tracking-widest"
                disabled={emailVerified}
              />
              <Button type="button" onClick={verifyEmail} disabled={emailVerified || emailVerifying || busy || emailCode.length < 6}>
                {emailVerifying ? "..." : "Tasdiqlash"}
              </Button>
            </div>
            {!emailVerified && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={resendEmailCode} disabled={busy}>
                Kodni qayta yuborish
              </button>
            )}
          </div>

          <TelegramBlock
            tgToken={tgToken}
            tgDeepLink={tgDeepLink}
            tgBound={tgBound}
            tgCode={tgCode}
            setTgCode={setTgCode}
            busy={busy}
            onStart={() => startTelegram("register")}
            verified={tgVerified}
            verifying={tgVerifying}
            onVerify={verifyTelegram}
          />

          {errorLine}
          <Button type="submit" className="w-full" disabled={busy || !emailVerified || !tgVerified}>
            {busy ? "Tasdiqlanmoqda..." : "Ro'yxatdan o'tish"}
          </Button>
          {(!emailVerified || !tgVerified) && (
            <p className="text-xs text-center text-muted-foreground">
              {!emailVerified && !tgVerified
                ? "Email va Telegram tasdiqlanishi kutilmoqda."
                : !emailVerified
                  ? "Email tasdiqlanishi kutilmoqda."
                  : "Telegram tasdiqlanishi kutilmoqda."}
            </p>
          )}
          <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => { setRegStep("form"); setError(""); }}>Ortga</button>
        </form>
      </AuthCard>
    );
  }

  // ---------- Register: form step ----------
  if (mode === "register") {
    return (
      <AuthCard title="Hisob yaratish" description="Username, email, parol va Telegram">
        <form onSubmit={submitRegisterForm} className="space-y-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              placeholder="masalan: ali_99"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              minLength={4}
              maxLength={20}
              required
              aria-invalid={username && usernameFree === false ? true : undefined}
              className={username && usernameFree === true ? "border-success" : ""}
            />
            {username && !checkingUsername && usernameFree !== null && (
              <p className={`text-sm ${usernameFree ? "text-success" : "text-destructive"}`} role="status">{usernameFree ? "✓ Mavjud" : "Bu username band"}</p>
            )}
            {username && checkingUsername && <p className="text-sm text-warning">Tekshirilmoqda...</p>}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <PasswordField
            label="Parol"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <div className="space-y-2">
            <Label>Jinsingiz (majburiy)</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setGender("male")}
                aria-pressed={gender === "male"}
                className={cn(
                  "flex items-center justify-center py-2 px-4 rounded-lg border-2 transition-all font-bold",
                  gender === "male"
                    ? "border-info bg-info/10 text-info"
                    : "border-border bg-card text-muted-foreground hover:border-info/40"
                )}
              >
                ♂ O'g'il bola
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                aria-pressed={gender === "female"}
                className={cn(
                  "flex items-center justify-center py-2 px-4 rounded-lg border-2 transition-all font-bold",
                  gender === "female"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                )}
              >
                ♀ Qiz bola
              </button>
            </div>
          </div>
          {errorLine}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Yuborilmoqda..." : "Davom etish"}</Button>
          <div className="text-center text-sm text-muted-foreground">
            Hisobingiz bormi?{" "}
            <button type="button" className="text-primary hover:underline font-medium" onClick={() => { setMode("login"); setError(""); }}>Kirish</button>
          </div>
        </form>
      </AuthCard>
    );
  }

  // ---------- Login ----------
  return (
    <>
    <SEO title="Kirish" noindex />
    <AuthCard title="Kirish" description="Parol yoki Telegram orqali">
      <div className="flex gap-2 mb-4">
        <Button type="button" variant={loginTab === "password" ? "default" : "outline"} className="flex-1" onClick={() => { setLoginTab("password"); setError(""); }}>Parol</Button>
        <Button type="button" variant={loginTab === "telegram" ? "default" : "outline"} className="flex-1" onClick={() => { setLoginTab("telegram"); setError(""); }}><Send className="w-4 h-4 mr-1" /> Telegram</Button>
      </div>

      {loginTab === "password" ? (
        <form onSubmit={submitLoginPassword} className="space-y-4">
          <div className="space-y-2">
            <Label>Email yoki username</Label>
            <Input placeholder="you@example.com yoki ali_99" value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
          </div>
          <PasswordField
            label="Parol"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
            labelAction={
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowForgot(true)}>Parolni unutdingizmi?</button>
            }
          />
          {errorLine}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Kirilmoqda..." : "Kirish"}</Button>
        </form>
      ) : (
        <form onSubmit={submitLoginTelegram} className="space-y-4">
          <TelegramBlock
            tgToken={tgToken}
            tgDeepLink={tgDeepLink}
            tgBound={tgBound}
            tgCode={tgCode}
            setTgCode={setTgCode}
            busy={busy}
            onStart={() => startTelegram("login")}
          />
          {errorLine}
          <Button type="submit" className="w-full" disabled={busy || !tgCode}>{busy ? "Kirilmoqda..." : "Telegram orqali kirish"}</Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Hisobingiz yo'qmi?{" "}
        <button type="button" className="text-primary hover:underline font-medium" onClick={() => { setMode("register"); setRegStep("form"); setError(""); }}>Ro'yxatdan o'tish</button>
      </div>
    </AuthCard>
    </>
  );
}
