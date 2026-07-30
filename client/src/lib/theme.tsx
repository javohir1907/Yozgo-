import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "dark" | "light" | "system";
type Resolved = "dark" | "light";

const STORAGE_KEY = "yozgo-theme";
const OLD_KEY = "yozgo-ui-theme"; // pre-redesign; read for migration

interface ThemeState {
  theme: Theme;
  resolvedTheme: Resolved;
  setTheme: (t: Theme) => void;
}

// Guard now works: the context default is undefined, so useTheme throws when
// used outside the provider (the old code passed a non-undefined default, so
// the guard could never fire).
const Ctx = createContext<ThemeState | undefined>(undefined);

function readStored(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
    // Migrate an explicit pre-redesign choice; absence means dark.
    const old = localStorage.getItem(OLD_KEY);
    if (old === "light" || old === "dark") return old;
  } catch {
    /* Safari private mode throws on access */
  }
  return "dark";
}

function systemTheme(): Resolved {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [systemResolved, setSystemResolved] = useState<Resolved>(systemTheme);

  // Track the OS preference while in "system" mode.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystemResolved(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: Resolved = theme === "system" ? systemResolved : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    // Enable the crossfade only after the first paint, so the anti-FOUC script's
    // correct first frame is simply there, not animated in.
    root.classList.add("theme-transition");
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = (): ThemeState => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
};
