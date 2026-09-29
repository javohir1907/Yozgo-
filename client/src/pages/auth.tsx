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
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [copiedManual, setCopiedManual] = useState(false);

  // Eight characters, not the full 32-hex token: copying a 32-character string
  // and pasting it into Telegram is a chore people abandon. The bot resolves
  // this prefix back to the token.
  const pairingCode = tgToken.slice(0, 8).toUpperCase();

  const onCopyManual = async () => {
    const value = pairingCode;
    try {
      // navigator.clipboard is undefined on insecure origins and can be denied,
      // so fall back to the execCommand path rather than failing silently.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedManual(true);
      setTimeout(() => setCopiedManual(false), 2000);
    } catch {
      /* the code is on screen and selectable anyway */
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1"><Send className="w-4 h-4 text-info" /> {t.auth.tgVerification}</Label>
        {verified ? (
          <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t.auth.verified}</span>
        ) : tgBound ? (
          <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t.auth.connected}</span>
        ) : null}
      </div>
      {/* Once the link exists, a real anchor IS the button. window.open() runs
          after an await, so browsers treat it as a non-user-initiated popup and
          block it — the bot then simply never opened and the only way out was a
          small fallback link most people missed. */}
      {!verified && (
        tgDeepLink ? (
          <Button asChild type="button" variant="outline" className="w-full" disabled={busy}>
            <a href={tgDeepLink} target="_blank" rel="noreferrer" data-testid="link-open-bot">
              <Send className="w-4 h-4 mr-2" /> {t.auth.openBot}
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={onStart} disabled={busy}>
            <Send className="w-4 h-4 mr-2" /> {t.auth.openBot}
          </Button>
        )
      )}
      {tgDeepLink && !verified && (
        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {t.auth.reopenBot}
        </button>
      )}
      <p className="text-xs text-muted-foreground">{t.auth.tgHelp}</p>

      {/* Manual path. The deep link only carries its payload when Telegram
          itself opens the chat; pressing "START BOT" on the t.me web page —
          what a desktop browser shows — often drops it, and registration then
          dead-ends with no phone prompt. The bot accepts this same text as a
          normal message, so the user can finish from their phone regardless. */}
      {tgToken && !verified && (
        <div className="rounded-md border border-dashed p-2 space-y-1.5">
          <p className="text-[11px] leading-snug text-muted-foreground">{t.auth.manualTitle}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1 text-center font-mono text-sm font-bold tracking-[0.3em]" data-testid="text-manual-auth">
              {pairingCode}
            </code>
            <Button type="button" size="sm" variant="secondary" onClick={onCopyManual}>
              {copiedManual ? t.auth.manualCopied : t.auth.manualCopy}
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder={t.auth.tgCodePlaceholder}
          value={tgCode}
          onChange={(e) => setTgCode(e.target.value)}
          maxLength={6}
          className="text-center tracking-widest"
          disabled={verified}
        />
        {onVerify && (
          <Button type="button" onClick={onVerify} disabled={verified || verifying || busy || tgCode.length < 6}>
            {verifying ? "..." : t.auth.verify}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { login, register, loginTelegram, isAuthenticated } = useAuth();
  const { t } = useI18n();
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
  // Resend gave no feedback at all, so it read as another dead button.
  const [emailResent, setEmailResent] = useState(false);

  // Username availability (register form)
  useEffect(() => {
    if (mode !== "register" || !username) {
      setUsernameFree(null);
      return;
    }
    setCheckingUsername(true);
    // Renamed off `t` — that now holds the translations for this component.
    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(normalizeUrl(`/api/auth/check-username?username=${encodeURIComponent(username)}`));
        if (res.ok) setUsernameFree((await res.json()).available);
      } catch { /* ignore */ } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(debounce);
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

  // Server xatolarini UI tiliga o'giradi. Known machine-readable codes are
  // translated; anything else falls back to the server's own text, and finally
  // to a translated generic message — so an English UI never shows raw Uzbek
  // (or a raw JSON parse error).
  const serverMsg = (d: any, fallback: string): string => {
    if (d?.code === "RATE_LIMITED") return t.auth.rateLimited;
    return d?.message || fallback;
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
        body: JSON.stringify({ purpose, previousToken: tgToken || undefined }),
      });
      const d = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(serverMsg(d, t.auth.tgConnectError));
      setTgToken(d.token);
      setTgDeepLink(d.deepLink);
      setTgBound(false);
      setTgVerified(false);
      setTgCode("");
      // No window.open here: after the await it is a blocked popup in every
      // modern browser. The UI turns the returned deepLink into a real anchor,
      // which always works.
    } catch (e: any) {
      setError(e.message || t.auth.genericError);
    } finally {
      setBusy(false);
    }
  }

  // Register 1-qadam: email OTP + Telegram token
  async function submitRegisterForm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (username.length < 4) { setError(t.auth.usernameMin); return; }
    if (usernameFree === false) { setError(t.auth.usernameExists); return; }
    if (password.length < 6) { setError(t.auth.passwordMin); return; }
    setBusy(true);
    try {
      const res = await fetch(normalizeUrl(`/api/auth/register/email-otp`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(serverMsg(d, t.auth.emailCodeSendError));
      setEmailVerified(false);
      setEmailCode("");
      setEmailToken("");
      await startTelegram("register");
      setRegStep("verify");
    } catch (e: any) {
      setError(e.message || t.auth.genericError);
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
      if (!res.ok) throw new Error(serverMsg(d, t.auth.emailCodeSendError));
      setEmailVerified(false);
      setEmailCode("");
      setEmailToken("");
      setEmailResent(true);
      setTimeout(() => setEmailResent(false), 4000);
    } catch (e: any) {
      setError(e.message || t.auth.genericError);
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
      if (!res.ok) throw new Error(serverMsg(d, t.auth.emailCodeVerifyError));
      setEmailVerified(true);
      setEmailToken(d.emailToken || "");
    } catch (e: any) {
      setError(e.message || t.auth.genericError);
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
      if (!res.ok) throw new Error(serverMsg(d, t.auth.tgCodeVerifyError));
      setTgVerified(true);
    } catch (e: any) {
      setError(e.message || t.auth.genericError);
    } finally {
      setTgVerifying(false);
    }
  }

  // Register 2-qadam: ikkala kanal tasdiqlangach yakuniy ro'yxat
  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!emailVerified || !emailToken) { setError(t.auth.emailNotVerified); return; }
    if (!tgVerified) { setError(t.auth.tgNotVerified); return; }
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
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.message || t.auth.genericError); return; }
      setForgotSent(true);
    } catch {
      setError(t.auth.networkError);
    }
  }

  const errorLine = error ? <InlineAlert tone="danger">{error}</InlineAlert> : null;

  // ---------- Forgot password ----------
  if (showForgot) {
    return (
      <AuthCard title={t.auth.forgotTitle}>
        {forgotSent ? (
          <div className="text-center space-y-4">
            <Mail className="w-12 h-12 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">{t.auth.forgotSentMsg}</p>
            <Button className="w-full" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}>{t.auth.back}</Button>
          </div>
        ) : (
          <form onSubmit={submitForgot} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{t.auth.email}</Label>
              <Input id="forgot-email" type="email" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            </div>
            {errorLine}
            <Button type="submit" className="w-full">{t.auth.send}</Button>
            <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowForgot(false)}>{t.auth.back}</button>
          </form>
        )}
      </AuthCard>
    );
  }

  // ---------- Register: verify step (har kanal ALOHIDA tasdiqlanadi) ----------
  if (mode === "register" && regStep === "verify") {
    return (
      <AuthCard title={t.auth.twoStepTitle} description={t.auth.twoStepDesc}>
        <form onSubmit={submitRegister} className="space-y-4">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            {t.auth.stepVerifyOf}
          </p>
          <p className="text-xs text-muted-foreground">{t.auth.whyTelegram}</p>
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1"><Mail className="w-4 h-4 text-primary" /> {t.auth.emailCodeLabel}</Label>
              {emailVerified && (
                <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {t.auth.verified}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t.auth.emailCodeSentTo} {email}</p>
            <div className="flex gap-2">
              <Input
                placeholder={t.auth.emailCodePlaceholder}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                maxLength={6}
                className="text-center tracking-widest"
                disabled={emailVerified}
              />
              <Button type="button" onClick={verifyEmail} disabled={emailVerified || emailVerifying || busy || emailCode.length < 6}>
                {emailVerifying ? "..." : t.auth.verify}
              </Button>
            </div>
            {!emailVerified && (
              <div className="flex items-center gap-2">
                <button type="button" className="text-xs text-primary hover:underline disabled:opacity-50" onClick={resendEmailCode} disabled={busy}>
                  {t.auth.resendCode}
                </button>
                {emailResent && <span className="text-xs text-success">{t.auth.codeResent}</span>}
              </div>
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
            {busy ? t.auth.verifyingBusy : t.auth.registerSubmit}
          </Button>
          {(!emailVerified || !tgVerified) && (
            <p className="text-xs text-center text-muted-foreground">
              {!emailVerified && !tgVerified
                ? t.auth.waitingBoth
                : !emailVerified
                  ? t.auth.waitingEmail
                  : t.auth.waitingTelegram}
            </p>
          )}
          <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => { setRegStep("form"); setError(""); }}>{t.auth.back}</button>
        </form>
      </AuthCard>
    );
  }

  // ---------- Register: form step ----------
  if (mode === "register") {
    return (
      <AuthCard title={t.auth.createTitle} description={t.auth.createDesc}>
        <form onSubmit={submitRegisterForm} className="space-y-5">
          {/* Every field below carries a one-line explanation. Users were
              guessing what each input and button actually meant, and the
              character rules only surfaced as an error after submitting. */}
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            {t.auth.stepOf}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="reg-username">{t.auth.username}</Label>
            <Input
              id="reg-username"
              placeholder={t.auth.usernamePlaceholder}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              minLength={4}
              maxLength={20}
              required
              aria-invalid={username && usernameFree === false ? true : undefined}
              aria-describedby="reg-username-hint"
              className={username && usernameFree === true ? "border-success" : ""}
            />
            {username && !checkingUsername && usernameFree !== null && (
              <p className={`text-sm ${usernameFree ? "text-success" : "text-destructive"}`} role="status">{usernameFree ? t.auth.usernameFree : t.auth.usernameTaken}</p>
            )}
            {username && checkingUsername && <p className="text-sm text-warning">{t.auth.checking}</p>}
            <p id="reg-username-hint" className="text-xs text-muted-foreground">{t.auth.usernameHint}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reg-email">{t.auth.email}</Label>
            <Input id="reg-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-describedby="reg-email-hint" />
            <p id="reg-email-hint" className="text-xs text-muted-foreground">{t.auth.emailHint}</p>
          </div>

          <div className="space-y-1.5">
            <PasswordField
              label={t.auth.password}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={6}
              required
            />
            <p className="text-xs text-muted-foreground">{t.auth.passwordHint}</p>
          </div>

          <div className="space-y-2">
            <Label>{t.auth.genderLabel}</Label>
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
                ♂ {t.auth.boy}
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
                ♀ {t.auth.girl}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t.auth.genderHint}</p>
          </div>
          {errorLine}
          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={busy}>{busy ? t.auth.sending : t.auth.continueBtn}</Button>
            <p className="text-xs text-center text-muted-foreground">{t.auth.continueHint}</p>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {t.auth.hasAccount}{" "}
            <button type="button" className="text-primary hover:underline font-medium" onClick={() => { setMode("login"); setError(""); }}>{t.auth.loginLink}</button>
          </div>
        </form>
      </AuthCard>
    );
  }

  // ---------- Login ----------
  return (
    <>
    <SEO title={t.auth.loginTitle} noindex />
    <AuthCard title={t.auth.loginTitle} description={t.auth.loginMethods}>
      <div className="flex gap-2 mb-4">
        <Button type="button" variant={loginTab === "password" ? "default" : "outline"} className="flex-1" onClick={() => { setLoginTab("password"); setError(""); }}>{t.auth.passwordTab}</Button>
        <Button type="button" variant={loginTab === "telegram" ? "default" : "outline"} className="flex-1" onClick={() => { setLoginTab("telegram"); setError(""); }}><Send className="w-4 h-4 mr-1" /> {t.auth.telegramTab}</Button>
      </div>

      {loginTab === "password" ? (
        <form onSubmit={submitLoginPassword} className="space-y-4">
          <div className="space-y-2">
            <Label>{t.auth.emailOrUsername}</Label>
            <Input placeholder={t.auth.emailOrUsernamePlaceholder} value={loginId} onChange={(e) => setLoginId(e.target.value)} required />
          </div>
          <PasswordField
            label={t.auth.password}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
            labelAction={
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowForgot(true)}>{t.auth.forgotPassword}</button>
            }
          />
          {errorLine}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? t.auth.signingIn : t.auth.login}</Button>
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
          <Button type="submit" className="w-full" disabled={busy || !tgCode}>{busy ? t.auth.signingIn : t.auth.loginWithTelegram}</Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground">
        {t.auth.noAccount}{" "}
        <button type="button" className="text-primary hover:underline font-medium" onClick={() => { setMode("register"); setRegStep("form"); setError(""); }}>{t.auth.registerLink}</button>
      </div>
    </AuthCard>
    </>
  );
}
