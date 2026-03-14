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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">>
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <img src="/logo.png" alt="YOZGO Logo" className="h-10 sm:h-12 w-auto object-cover rounded-md sm:rounded-lg" /> />
          </Link>


          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={`gap-2 h-10 px-4 transition-colors ${location === item.href ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                    }`}
                  data-testid={`link-nav-${item.href.replace('/', '')}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </div>


        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-ui-lang">
                <Globe className="w-5 h-5" />
                <span className="sr-only">Language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {uiLangOptions.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setUILang(lang.code)}
                  className={uiLang === lang.code ? "bg-accent text-accent-foreground" : ""}
                  data-testid={`button-ui-lang-${lang.code}`}
                >
