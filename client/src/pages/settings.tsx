import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme";
import { useI18n, type UILanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

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
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem("yozgo-user-settings");
    return saved ? JSON.parse(saved) : {
      fontFamily: "font-mono",
      defaultTimer: "30",
      defaultLanguage: "en",
    };
  });

  useEffect(() => {
    localStorage.setItem("yozgo-user-settings", JSON.stringify(settings));
    
    const root = window.document.documentElement;
    FONTS.forEach(f => root.classList.remove(f.id));
    root.classList.add(settings.fontFamily);
  }, [settings]);

  const updateSetting = (key: keyof UserSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
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
    <div className="container max-w-2xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">{t.settings.title}</h1>

      <div className="space-y-6">
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
                  {FONTS.map(font => (
                    <SelectItem key={font.id} value={font.id} data-testid={`select-item-font-${font.id}`}>
                      {font.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ui-language">{t.settings.interfaceLanguage}</Label>
              <p className="text-sm text-muted-foreground">{t.settings.interfaceLanguageDesc}</p>
              <Select 
                value={uiLang} 
                onValueChange={(v) => setUILang(v as UILanguage)}
              >
                <SelectTrigger id="ui-language" data-testid="select-ui-language">
                  <SelectValue placeholder={t.settings.selectLanguage} />
                </SelectTrigger>
                <SelectContent>
                  {UI_LANGUAGES.map(lang => (
                    <SelectItem key={lang.id} value={lang.id} data-testid={`select-item-ui-lang-${lang.id}`}>
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
                  {TIMERS.map(time => (
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
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.id} value={lang.id} data-testid={`select-item-lang-${lang.id}`}>
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
