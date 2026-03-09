import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export type Language = "en" | "ru" | "uz";

interface LanguageSelectorProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export function LanguageSelector({ currentLanguage, onLanguageChange }: LanguageSelectorProps) {
  const { t } = useI18n();

  const languages: { code: Language; label: string }[] = [
    { code: "en", label: t.languages.english },
    { code: "ru", label: t.languages.russian },
    { code: "uz", label: t.languages.uzbek },
  ];

  return (
    <div className="flex gap-2 justify-center mb-4" data-testid="language-selector">
      {languages.map((lang) => (
        <Button
          key={lang.code}
          variant="ghost"
          size="sm"
          className={cn(
            "text-xs font-mono transition-all",
            currentLanguage === lang.code ? "text-primary bg-muted" : "text-muted-foreground hover:text-primary"
          )}
          onClick={() => onLanguageChange(lang.code)}
          data-testid={`button-lang-${lang.code}`}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  );
}
