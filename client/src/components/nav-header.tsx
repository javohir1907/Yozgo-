import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Keyboard, Trophy, Users, Settings, User as UserIcon, LogOut, Globe, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { useI18n, type UILanguage } from "@/lib/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NavHeader() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { t, uiLang, setUILang } = useI18n();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { label: t.nav.test, href: "/typing-test", icon: Keyboard },
    { label: t.nav.leaderboard, href: "/leaderboard", icon: Trophy },
    { label: t.nav.battle, href: "/battle", icon: Users },
  ];

  const uiLangOptions: { code: UILanguage; label: string }[] = [
    { code: "en", label: "EN" },
    { code: "ru", label: "RU" },
    { code: "uz", label: "UZ" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md border-b-[3px] border-primary shadow-[0_4px_10px_rgba(249,115,22,0.15)]">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center group mr-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {["Y", "O", "Z", "G", "O"].map((letter, i) => (
                <div
                  key={i}
                  className="relative w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center cursor-pointer select-none rounded-lg border transition-all duration-75 font-sans font-black text-sm sm:text-base
                             bg-white border-gray-200 text-gray-800 shadow-[0_4px_0_rgb(209,213,219)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgb(209,213,219)] active:translate-y-1 active:shadow-[0_0px_0_rgb(209,213,219)]
                             dark:bg-[#28282b] dark:border-[#111] dark:text-[#fcfcfc] dark:shadow-[0_4px_0_rgb(10,10,10)] dark:hover:-translate-y-0.5 dark:hover:shadow-[0_6px_0_rgb(10,10,10)] dark:active:translate-y-1 dark:active:shadow-[0_0px_0_rgb(10,10,10)]"
                >
                  <span>{letter}</span>
                  {/* Klaviaturalardagi F va J harflariga o'xshash orientir do'mboqchalar (O va G harflariga) */}
                  {(i === 1 || i === 3) && (
                    <div className="absolute bottom-[15%] w-[30%] h-[2px] bg-gray-400 dark:bg-[#555] rounded-full" />
                  )}
                </div>
              ))}
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`relative gap-2 h-10 px-4 transition-all duration-300 font-bold ${isActive
                        ? "text-primary bg-primary/10 hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    data-testid={`link-nav-${item.href.replace("/", "")}`}
                  >
                    {isActive && (
                      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-sm"></div>
                    )}
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 border-l-2 border-muted pl-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                data-testid="button-ui-lang"
              >
                <Globe className="w-5 h-5" />
                <span className="sr-only">Language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-sans font-medium rounded-xl border-2">
              {uiLangOptions.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setUILang(lang.code)}
                  className={`font-semibold ${uiLang === lang.code ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid={`button-ui-lang-${lang.code}`}
                >
                  {lang.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              data-testid="link-settings"
            >
              <Settings className="w-5 h-5" />
              <span className="sr-only">{t.nav.settings}</span>
            </Button>
          </Link>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-xl border-2 border-transparent hover:border-primary transition-all bg-muted overflow-hidden"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-full w-full rounded-lg">
                    <AvatarImage
                      src={user?.profileImageUrl || undefined}
                      alt={user?.firstName || user?.email || "User"}
                    />
                    <AvatarFallback className="bg-transparent text-foreground font-bold rounded-lg">
                      {(user?.firstName || user?.email || "U").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-correct border-2 border-background rounded-full"></div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 font-sans rounded-xl border-2 p-2" align="end" forceMount>
                <DropdownMenuLabel className="font-normal border-b pb-2 mb-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold text-foreground">
                      {user?.firstName || user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuItem asChild className="font-medium rounded-lg cursor-pointer">
                  <Link href="/profile" className="flex items-center w-full">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>{t.nav.profile}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive font-medium focus:text-destructive focus:bg-destructive/10 rounded-lg cursor-pointer mt-1"
                  onClick={() => logout()}
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t.nav.logOut}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button size="sm" data-testid="button-login" className="font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-sm">
                {t.nav.signIn}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
