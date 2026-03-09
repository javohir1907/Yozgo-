import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/lib/theme";
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
const LANGUAGES = [
  { id: "en", name: "English" },
  { id: "ru", name: "Russian" },
  { id: "uz", name: "Uzbek" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
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
    
    // Apply font family to document
    const root = window.document.documentElement;
    FONTS.forEach(f => root.classList.remove(f.id));
    root.classList.add(settings.fontFamily);
  }, [settings]);

  const updateSetting = (key: keyof UserSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast({
      title: "Settings updated",
      description: "Your preferences have been saved locally.",
    });
  };

  return (
    <div className="container max-w-2xl py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how the application looks and feels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Switch between dark and light themes.</p>
              </div>
              <Switch 
                checked={theme === "dark"} 
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                data-testid="switch-theme"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="font-family">Font Family</Label>
              <Select 
                value={settings.fontFamily} 
                onValueChange={(v) => updateSetting("fontFamily", v)}
              >
                <SelectTrigger id="font-family" data-testid="select-font-family">
                  <SelectValue placeholder="Select font" />
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
          </CardContent>
        </Card>

        {/* Typing Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Typing Preferences</CardTitle>
            <CardDescription>Default settings for your typing tests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="default-timer">Default Timer (seconds)</Label>
              <Select 
                value={settings.defaultTimer} 
                onValueChange={(v) => updateSetting("defaultTimer", v)}
              >
                <SelectTrigger id="default-timer" data-testid="select-default-timer">
                  <SelectValue placeholder="Select time" />
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
              <Label htmlFor="default-language">Default Language</Label>
              <Select 
                value={settings.defaultLanguage} 
                onValueChange={(v) => updateSetting("defaultLanguage", v)}
              >
                <SelectTrigger id="default-language" data-testid="select-default-language">
                  <SelectValue placeholder="Select language" />
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
