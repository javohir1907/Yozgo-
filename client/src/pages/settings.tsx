import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings as SettingsIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useI18n, type UILanguage } from "@/lib/i18n";
import {
  useUserSettings,
  type TypingFontId,
  type TypingSizeId,
} from "@/hooks/use-user-settings";
import { PageShell } from "@/components/layout/page-shell";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { t, uiLang, setUILang } = useI18n();
  const { settings, update } = useUserSettings();

  const TYPING_FONTS: { id: TypingFontId; name: string }[] = [
    { id: "jetbrains", name: "JetBrains Mono" },
    { id: "roboto", name: "Roboto Mono" },
    { id: "system", name: "System Mono" },
    { id: "inter", name: "Inter (Sans)" },
  ];
  const TYPING_SIZES: { id: TypingSizeId; name: string }[] = [
    { id: "s", name: t.settings.sizeSmall },
    { id: "m", name: t.settings.sizeMedium },
    { id: "l", name: t.settings.sizeLarge },
  ];
  const LANGUAGES = [
    { id: "en" as const, name: t.settings.english },
    { id: "ru" as const, name: t.settings.russian },
    { id: "uz" as const, name: t.settings.uzbek },
    { id: "kaa" as const, name: t.settings.karakalpak },
  ];
  const UI_LANGUAGES: { id: UILanguage; name: string }[] = LANGUAGES;
  // System mode arrives with the theme.tsx rewrite; two options until then.
  const THEMES: { id: "light" | "dark"; name: string }[] = [
    { id: "light", name: t.settings.themeLight },
    { id: "dark", name: t.settings.themeDark },
  ];

  return (
    <PageShell
      size="sm"
      icon={SettingsIcon}
      title={t.settings.title}
      seo={{ title: t.settings.title, noindex: true }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.appearance}</CardTitle>
          <CardDescription>{t.settings.appearanceDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="theme-mode">{t.settings.darkMode}</Label>
              <p className="text-sm text-muted-foreground">{t.settings.darkModeDesc}</p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
              <SelectTrigger id="theme-mode" className="sm:w-40" data-testid="select-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((th) => (
                  <SelectItem key={th.id} value={th.id}>
                    {th.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SettingSelect
            id="ui-language"
            label={t.settings.interfaceLanguage}
            description={t.settings.interfaceLanguageDesc}
            value={uiLang}
            onChange={(v) => setUILang(v as UILanguage)}
            options={UI_LANGUAGES}
            testid="select-ui-language"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.typingPrefs}</CardTitle>
          <CardDescription>{t.settings.typingPrefsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SettingSelect
            id="typing-font"
            label={t.settings.typingFont}
            value={settings.typingFont}
            onChange={(v) => update("typingFont", v as TypingFontId)}
            options={TYPING_FONTS}
            testid="select-typing-font"
          />
          <SettingSelect
            id="typing-size"
            label={t.settings.typingSize}
            value={settings.typingSize}
            onChange={(v) => update("typingSize", v as TypingSizeId)}
            options={TYPING_SIZES}
            testid="select-typing-size"
          />
          <SettingSelect
            id="default-timer"
            label={t.settings.defaultTimer}
            value={String(settings.defaultTimer)}
            onChange={(v) => update("defaultTimer", Number(v) as 15 | 30 | 60)}
            options={[
              { id: "15", name: "15s" },
              { id: "30", name: "30s" },
              { id: "60", name: "60s" },
            ]}
            testid="select-default-timer"
          />
          <SettingSelect
            id="default-language"
            label={t.settings.defaultLanguage}
            value={settings.defaultLanguage}
            onChange={(v) => update("defaultLanguage", v as typeof settings.defaultLanguage)}
            options={LANGUAGES}
            testid="select-default-language"
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}

function SettingSelect({
  id,
  label,
  description,
  value,
  onChange,
  options,
  testid,
}: {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  testid?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} data-testid={testid}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id} data-testid={`${testid}-${o.id}`}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
