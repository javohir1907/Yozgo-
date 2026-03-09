import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Language = "en" | "ru" | "uz";

interface LanguageSelectorProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export function LanguageSelector({ currentLanguage, onLanguageChange }: LanguageSelectorProps) {
  const languages: { code: Language; label: string }[] = [
    { code: "en", label: "English" },
    { code: "ru", label: "Russian" },
    { code: "uz", label: "Uzbek" },
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
