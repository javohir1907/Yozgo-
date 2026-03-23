import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Keyboard, Trophy, Users, Settings, User as UserIcon, LogOut, Globe } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
    <header className="sticky top-0 z-50 w-full border-b border-primary/30 bg-background/80 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.1)]">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity group">
            <div className="flex items-center gap-2 relative">
              {/* HUD scanline effect behind logo */}
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 group-hover:bg-primary/40 transition-all duration-500"></div>
              <span className="relative font-heading text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">
                YOZGO
              </span>
              <div className="h-4 w-1 bg-primary shadow-[0_0_8px_var(--primary)] animate-pulse"></div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`relative gap-2 h-10 px-4 transition-all duration-300 uppercase tracking-widest font-sans text-xs ${
                      isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    }`}
                    data-testid={`link-nav-${item.href.replace("/", "")}`}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_10px_var(--primary)]"></div>
                    )}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary/50"></div>
                    )}
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 border-l border-primary/20 pl-4 relative">
          {/* Decorative HUD dot */}
          <div className="absolute -left-[2px] top-1/2 -translate-y-1/2 w-1 h-3 bg-primary/50"></div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all"
                data-testid="button-ui-lang"
              >
                <Globe className="w-4 h-4" />
                <span className="sr-only">Language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-primary/30 bg-background/95 backdrop-blur font-sans">
              {uiLangOptions.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setUILang(lang.code)}
                  className={`uppercase tracking-wider text-xs ${uiLang === lang.code ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-primary"}`}
                  data-testid={`button-ui-lang-${lang.code}`}
                >
                  {lang.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all"
              data-testid="link-settings"
            >
              <Settings className="w-4 h-4 text-primary animate-[spin_10s_linear_infinite]" />
              <span className="sr-only">{t.nav.settings}</span>
            </Button>
          </Link>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-none border border-primary/30 hover:border-primary/80 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all bg-background/50 overflow-hidden"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-full w-full rounded-none">
                    <AvatarImage
                      src={user?.profileImageUrl || undefined}
                      alt={user?.firstName || user?.email || "User"}
                      className="opacity-80 mix-blend-screen"
                    />
                    <AvatarFallback className="bg-transparent text-primary font-heading font-bold rounded-none">
                      {(user?.firstName || user?.email || "U").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-correct shadow-[0_0_5px_var(--correct)]"></div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 border-primary/30 bg-background/95 backdrop-blur font-sans" align="end" forceMount>
                <DropdownMenuLabel className="font-normal border-b border-primary/20 pb-2 mb-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold text-primary tracking-wide uppercase">
                      {user?.firstName || user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuItem asChild className="hover:bg-primary/10 hover:text-primary uppercase tracking-wider text-xs">
                  <Link href="/profile" className="flex items-center w-full cursor-pointer">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>{t.nav.profile}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer uppercase tracking-wider text-xs mt-1"
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
              <Button size="sm" data-testid="button-login" className="font-heading uppercase tracking-widest bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_var(--primary)] transition-all">
                {t.nav.signIn}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
