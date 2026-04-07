import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme";
import { useI18n, type UILanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, User as UserIcon } from "lucide-react";

type UserSettings = {
  fontFamily: string;
  defaultTimer: string;
  defaultLanguage: string;
};

const FONTS = [
  { id: "font-sans", name: "Inter (Sans)" },
  { id: "font-mono", name: "Menlo (Mono)" },
  { id: "font-jetbrains", name: "JetBrains Mono" },
  { id: "font-roboto", name: "Roboto Mono" },
  { id: "font-fira", name: "Fira Code" },
];

const TIMERS = ["15", "30", "60"];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { t, uiLang, setUILang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [newNickname, setNewNickname] = useState(user?.firstName || "");
  const [isUpdatingNick, setIsUpdatingNick] = useState(false);

  const handleUpdateNickname = async () => {
    if (!newNickname || newNickname.length < 4) {
      return toast({ variant: "destructive", title: "Nickname juda qisqa" });
    }
    
    setIsUpdatingNick(true);
    try {
      const res = await apiRequest("POST", "/api/auth/update-nickname", { newNickname });
      const data = await res.json();
      
      if (res.ok) {
        toast({ title: "Muvaffaqiyatli", description: data.message });
        window.location.reload(); // Refresh to get updated user data
      } else {
        toast({ variant: "destructive", title: "Xatolik", description: data.message });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Xatolik", description: err.message });
    } finally {
      setIsUpdatingNick(false);
    }
  };

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem("yozgo-user-settings");
    return saved
      ? JSON.parse(saved)
      : {
          fontFamily: "font-mono",
          defaultTimer: "30",
          defaultLanguage: "en",
        };
  });

  useEffect(() => {
    localStorage.setItem("yozgo-user-settings", JSON.stringify(settings));

    const root = window.document.documentElement;
    FONTS.forEach((f) => root.classList.remove(f.id));
    root.classList.add(settings.fontFamily);
  }, [settings]);

  const updateSetting = (key: keyof UserSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    toast({
      title: t.settings.updated,
      description: t.settings.updatedDesc,
    });
  };

  const LANGUAGES = [
    { id: "en", name: t.settings.english },
    { id: "ru", name: t.settings.russian },
    { id: "uz", name: t.settings.uzbek },
  ];

  const UI_LANGUAGES: { id: UILanguage; name: string }[] = [
    { id: "en", name: t.settings.english },
    { id: "ru", name: t.settings.russian },
    { id: "uz", name: t.settings.uzbek },
  ];

  return (
    <div className="container max-w-2xl py-12 px-4 pb-24">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <UserIcon className="w-8 h-8 text-primary" />
        {t.settings.title}
      </h1>

      <div className="space-y-6">
        {/* Profile Card */}
        <Card className="border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle>Profil Ma'lumotlari</CardTitle>
            <CardDescription>Shaxsiy profilingizni boshqarish va xavfsizlik sozlamalari.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nickname Change */}
            <div className="space-y-3">
              <Label>Nickname (Foydalanuvchi nomi)</Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input 
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="Yangi nickname..."
                  className="flex-1 font-mono"
                  maxLength={20}
                />
                <Button 
                  onClick={handleUpdateNickname} 
                  disabled={isUpdatingNick || newNickname === user?.firstName}
                  className="btn-3d font-bold whitespace-nowrap"
                >
                  {isUpdatingNick ? "Yangilanmoqda..." : "Saqlash"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Nicknameni har 90 kunda faqat bir marta o'zgartirish mumkin.
              </p>
            </div>

            {/* Gender Display (Non-editable) */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Jinsingiz</Label>
                  <p className="text-sm font-medium text-foreground uppercase tracking-wider">
                    {user?.gender === "male" ? "♂ O'g'il bola" : user?.gender === "female" ? "♀ Qiz bola" : "Tanlanmagan"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Xatolik bormi?</p>
                  <a href="https://t.me/yozgo_support_bot" target="_blank" rel="noreferrer" className="text-xs text-primary font-bold hover:underline bg-primary/5 px-2 py-1 rounded">
                    Support bilan bog'lanish
                  </a>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug italic">
                * Jinsni o'zgartirish majburiy talablar sababidan faqat Support orqali amalga oshiriladi.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.appearance}</CardTitle>
            <CardDescription>{t.settings.appearanceDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>{t.settings.darkMode}</Label>
                <p className="text-sm text-muted-foreground">{t.settings.darkModeDesc}</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                data-testid="switch-theme"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="font-family">{t.settings.fontFamily}</Label>
              <Select
                value={settings.fontFamily}
                onValueChange={(v) => updateSetting("fontFamily", v)}
              >
                <SelectTrigger id="font-family" data-testid="select-font-family">
                  <SelectValue placeholder={t.settings.selectFont} />
                </SelectTrigger>
                <SelectContent>
                  {FONTS.map((font) => (
                    <SelectItem
                      key={font.id}
                      value={font.id}
                      data-testid={`select-item-font-${font.id}`}
                    >
                      {font.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ui-language">{t.settings.interfaceLanguage}</Label>
              <p className="text-sm text-muted-foreground">{t.settings.interfaceLanguageDesc}</p>
              <Select value={uiLang} onValueChange={(v) => setUILang(v as UILanguage)}>
                <SelectTrigger id="ui-language" data-testid="select-ui-language">
                  <SelectValue placeholder={t.settings.selectLanguage} />
                </SelectTrigger>
                <SelectContent>
                  {UI_LANGUAGES.map((lang) => (
                    <SelectItem
                      key={lang.id}
                      value={lang.id}
                      data-testid={`select-item-ui-lang-${lang.id}`}
                    >
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.settings.typingPrefs}</CardTitle>
            <CardDescription>{t.settings.typingPrefsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="default-timer">{t.settings.defaultTimer}</Label>
              <Select
                value={settings.defaultTimer}
                onValueChange={(v) => updateSetting("defaultTimer", v)}
              >
                <SelectTrigger id="default-timer" data-testid="select-default-timer">
                  <SelectValue placeholder={t.settings.selectTime} />
                </SelectTrigger>
                <SelectContent>
                  {TIMERS.map((time) => (
                    <SelectItem key={time} value={time} data-testid={`select-item-timer-${time}`}>
                      {time}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-language">{t.settings.defaultLanguage}</Label>
              <Select
                value={settings.defaultLanguage}
                onValueChange={(v) => updateSetting("defaultLanguage", v)}
              >
                <SelectTrigger id="default-language" data-testid="select-default-language">
                  <SelectValue placeholder={t.settings.selectLanguage} />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem
                      key={lang.id}
                      value={lang.id}
                      data-testid={`select-item-lang-${lang.id}`}
                    >
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
