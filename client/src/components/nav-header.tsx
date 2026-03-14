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
























































