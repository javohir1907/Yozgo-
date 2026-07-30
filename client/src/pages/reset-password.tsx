import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AuthCard } from "@/components/layout/auth-card";
import { PasswordField } from "@/components/common/password-field";
import { InlineAlert } from "@/components/common/inline-alert";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  if (!token) {
    return (
      <AuthCard title="Yaroqsiz havola" description="Parolni tiklash havolasi yaroqsiz yoki muddati tugagan.">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
          <Button className="w-full" onClick={() => setLocation("/auth")}>
            Tizimga kirishga qaytish
          </Button>
        </div>
      </AuthCard>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Parollar mos tushmadi!");
      return;
    }
    if (password.length < 8) {
      setError("Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      // Was a bare fetch on import.meta.env.VITE_API_URL; apiRequest is the
      // shared client every other page uses (base URL + error handling).
      await apiRequest("POST", "/api/auth/reset-password", {
        token,
        newPassword: password,
      });
      toast({
        title: "Muvaffaqiyatli",
        description: "Parolingiz o'zgartirildi! Endi yangi parol bilan tizimga kirishingiz mumkin.",
      });
      setLocation("/auth");
    } catch (err: any) {
      setError(err?.message?.replace(/^\d{3}:\s*/, "") || "Ulanishda xatolik. Keyinroq urinib ko'ring.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard title="Yangi parol o'rnatish" description="Hisobingiz uchun yangi va mustahkam parol kiriting.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          label="Yangi parol"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="Kamida 8 ta belgi"
        />
        <PasswordField
          label="Parolni tasdiqlang"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={8}
          required
          placeholder="Yangi parolni takrorlang"
        />
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Parolni saqlash
        </Button>
      </form>
    </AuthCard>
  );
}
