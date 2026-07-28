import { useCallback, useEffect, useState } from "react";

export type TypingFontId = "jetbrains" | "roboto" | "system" | "inter";
export type TypingSizeId = "s" | "m" | "l";

export interface UserSettings {
  typingFont: TypingFontId;
  typingSize: TypingSizeId;
  defaultTimer: 15 | 30 | 60;
  defaultLanguage: "en" | "ru" | "uz" | "kaa";
}

const STORAGE_KEY = "yozgo-user-settings";

const DEFAULTS: UserSettings = {
  typingFont: "jetbrains",
  typingSize: "m",
  defaultTimer: 30,
  defaultLanguage: "en",
};

export const TYPING_FONT_STACKS: Record<TypingFontId, string> = {
  jetbrains: '"JetBrainsMonoVariable", ui-monospace, monospace',
  roboto: '"RobotoMonoVariable", ui-monospace, monospace',
  system: "ui-monospace, SFMono-Regular, Menlo, monospace",
  // The one non-mono option — deliberately kept for readers who prefer it.
  inter: "var(--font-sans)",
};

const TYPING_SCALE: Record<TypingSizeId, string> = {
  s: "0.85",
  m: "1",
  l: "1.2",
};

/**
 * Guards the JSON.parse that used to run bare inside a useState initializer —
 * corrupt storage there threw during render and, with no error boundary at the
 * time, took the whole app down. Unknown keys are dropped by merging over the
 * defaults, and each field is validated against its allowed set.
 */
function safeReadSettings(): UserSettings {
  if (typeof localStorage === "undefined") return DEFAULTS;
  let parsed: unknown;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULTS;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
  const p = parsed as Record<string, unknown>;
  return {
    typingFont:
      typeof p.typingFont === "string" && p.typingFont in TYPING_FONT_STACKS
        ? (p.typingFont as TypingFontId)
        : DEFAULTS.typingFont,
    typingSize:
      p.typingSize === "s" || p.typingSize === "m" || p.typingSize === "l"
        ? (p.typingSize as TypingSizeId)
        : DEFAULTS.typingSize,
    defaultTimer:
      p.defaultTimer === 15 || p.defaultTimer === 30 || p.defaultTimer === 60
        ? (p.defaultTimer as 15 | 30 | 60)
        : DEFAULTS.defaultTimer,
    defaultLanguage:
      p.defaultLanguage === "en" ||
      p.defaultLanguage === "ru" ||
      p.defaultLanguage === "uz" ||
      p.defaultLanguage === "kaa"
        ? (p.defaultLanguage as UserSettings["defaultLanguage"])
        : DEFAULTS.defaultLanguage,
  };
}

function applyTypingVars(s: UserSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--font-typing", TYPING_FONT_STACKS[s.typingFont]);
  root.style.setProperty("--typing-scale", TYPING_SCALE[s.typingSize]);
}

/**
 * Single owner of user settings: reads/writes localStorage and applies the
 * typing CSS vars. Previously settings.tsx was the only file that read this
 * key, and typing-test.tsx hardcoded its language/timer — so the settings did
 * nothing. typing-test now seeds its state from `defaultLanguage`/
 * `defaultTimer` here.
 */
export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(safeReadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage full / blocked — the in-memory value still applies this session */
    }
    applyTypingVars(settings);
  }, [settings]);

  const update = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { settings, update };
}

/** Read once without subscribing — used to seed typing-test's initial state. */
export function readUserSettings(): UserSettings {
  return safeReadSettings();
}
