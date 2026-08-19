import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProgressChart } from "@/components/progress-chart";
import {
  AppErrorBoundary,
  DefaultErrorFallback,
} from "@/components/layout/error-boundary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Target, Timer, BarChart3, History, Key, AlertCircle, User as UserIcon, Rocket, Flame, Repeat, CalendarCheck, Swords, Star, Lock, Crown, Copy, Check, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell } from "@/components/layout/page-shell";
import { QueryBoundary } from "@/components/common/query-boundary";
import { ProfileSkeleton } from "@/components/common/skeletons";
import { StatCard } from "@/components/common/stat-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { frameRingStyle } from "@/lib/frame";

interface ProfileData {
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
    gender?: string;
    role?: string;
    // Gamifikatsiya — XP & Level (server GET /api/profile'dan). Optional chaining
    // bilan o'qiladi (bosqichma-bosqich rollout).
    xp?: number;
    level?: number;
    xpIntoLevel?: number;
    xpForNextLevel?: number;
    levelPct?: number;
    // Feature 2 — kunlik streak
    currentStreak?: number;
    longestStreak?: number;
    // Feature 7 — rank/unvon (key)
    rank?: string;
    // Feature 8 — coin + kiyilgan kosmetika
    coins?: number;
    themeMeta?: { accent?: string } | null;
    frameMeta?: { ring?: string } | null;
  };
  stats: {
    totalTests: number;
    avgWpm: number;
    bestWpm: number;
    avgAccuracy: number;
  };
    detailedStats: {
      uz: Record<string, number>;
      ru: Record<string, number>;
      en: Record<string, number>;
      kaa: Record<string, number>;
    };
  recentResults: {
    id: string;
    wpm: number;
    accuracy: number;
    language: string;
    mode: string;
    createdAt: string;
  }[];
  // Kunlik faollik tarixi — "qaysi kuni nechta test" (so'nggi ~60 kun)
  dailyActivity?: {
    date: string;
    count: number;
    avgWpm: number;
  }[];
  // Feature 3 — badge katalogi (ochilgan + qulflangan)
  badges?: {
    earned: { key: string; icon: string; earnedAt?: string }[];
    locked: { key: string; icon: string }[];
  };
}

// badge-defs.ts dagi `icon` (lucide nomi) -> komponent.
const BADGE_ICONS: Record<string, LucideIcon> = {
  Rocket,
  Flame,
  Repeat,
  CalendarCheck,
  Swords,
  Target,
  Star,
  Crown,
};

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const { user: authUser } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();

  const currentUserId = params?.userId || authUser?.id;
  const isOwnProfile = !params?.userId || params.userId === authUser?.id;

  const [oldPassword, setOldPassword] = useState(""); // joriy (haqiqiy) parol — M3
  const [currentPassword, setCurrentPassword] = useState(""); // yangi parolni tasdiqlash
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [newNickname, setNewNickname] = useState(authUser?.firstName || "");
  const [isUpdatingNick, setIsUpdatingNick] = useState(false);

  const [idCopied, setIdCopied] = useState(false);
  const handleCopyId = async (id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const ta = document.createElement("textarea");
        ta.value = id;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("copy failed");
      }
      setIdCopied(true);
      toast({ title: t.battle.copied, description: t.profile.idCopiedDesc });
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: t.battle.copyFailed });
    }
  };

  const handleUpdateNickname = async () => {
    if (!newNickname || newNickname.length < 4) {
      return toast({ variant: "destructive", title: t.profile.nickTooShort });
    }
    
    setIsUpdatingNick(true);
    try {
      const res = await apiRequest("POST", "/api/auth/update-nickname", { newNickname });
      const data = await res.json();
      
      if (res.ok) {
        toast({ title: t.profile.success, description: data.message });
        // Was window.location.reload(), which threw away all state and scroll.
        queryClient.invalidateQueries({
          predicate: (q) =>
            typeof q.queryKey[0] === "string" &&
            (q.queryKey[0] as string).startsWith("/api/profile"),
        });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      } else {
        toast({ variant: "destructive", title: t.profile.error, description: data.message });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: t.profile.error, description: err.message });
    } finally {
      setIsUpdatingNick(false);
    }
  };

  const query = useQuery<ProfileData>({
    queryKey: [currentUserId ? `/api/profile/${currentUserId}` : "/api/profile/me"],
    enabled: !!currentUserId,
  });
  const { data, isLoading } = query;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      toast({ title: t.profile.error, description: t.profile.currentPassword, variant: "destructive" });
      return;
    }
    if (newPassword !== currentPassword) {
      toast({
        title: t.profile.error,
        description: t.profile.passwordsNotMatch,
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: t.profile.error,
        description: t.profile.passTooShort,
        variant: "destructive",
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      // M3: joriy parolni ham yuboramiz — server bcrypt.compare bilan tekshiradi.
      await apiRequest("POST", "/api/auth/update-password", {
        currentPassword: oldPassword,
        newPassword,
      });
      toast({
        title: t.profile.success,
        description: t.profile.passChanged,
      });
      setOldPassword("");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      toast({
        title: t.profile.error,
        description: err.message || t.profile.passChangeFail,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Was `if (isLoading || !data)` around the skeleton with no error branch, so
  // a failed request rendered the skeleton forever. QueryBoundary adds the
  // error branch; the skeleton is the extracted ProfileSkeleton.
  if (isLoading || query.isError || !data) {
    return (
      <PageShell size="lg" gap="loose">
        <QueryBoundary query={query} loading={<ProfileSkeleton />}>
          {null}
        </QueryBoundary>
      </PageShell>
    );
  }

  const { user, stats, recentResults, dailyActivity } = data;

  const chartData = [...recentResults].reverse().map((r) => ({
    date: format(new Date(r.createdAt), "MMM d"),
    wpm: r.wpm,
    accuracy: r.accuracy,
  }));

  // Server-supplied cosmetics. Only accept an HSL triple for the accent and a
  // hex for the ring — never interpolate an arbitrary string into a style.
  const accent =
    typeof user.themeMeta?.accent === "string" &&
    /^\d{1,3} \d{1,3}% \d{1,3}%$/.test(user.themeMeta.accent)
      ? user.themeMeta.accent
      : null;
  // The ring validation/rendering moved to lib/frame so every avatar in the app
  // draws the frame the same way; this page used to be the only one that did.
  const ringStyle = frameRingStyle(user.frameMeta, 4);

  return (
    <PageShell
      size="lg"
      gap="loose"
      className={accent ? undefined : undefined}
      seo={{
        title: `${user.username} | ${t.nav.profile}`,
      }}
    >
      <div
        className="space-y-8"
        style={accent ? ({ ["--primary" as any]: accent } as React.CSSProperties) : undefined}
      >
      <div className="flex items-center gap-6 mb-8">
        <Avatar
          className="h-24 w-24 border-2 border-primary/20"
          style={ringStyle}
        >
          <AvatarImage src={user.avatarUrl} alt={user.username} />
          <AvatarFallback className="text-4xl bg-primary/10 text-primary">
            {user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground" data-testid="text-username">
            {user.username}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {user.rank
                ? (t.leaderboard.rankTitles as Record<string, string>)[user.rank] ?? t.profile.typingEnthusiast
                : t.profile.typingEnthusiast}
            </p>
            {user.gender && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-border bg-secondary text-secondary-foreground">
                {user.gender === 'male' ? t.profile.boy : t.profile.girl}
              </span>
            )}
            {typeof user.currentStreak === "number" && user.currentStreak > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
                data-testid="badge-streak"
                title={`${t.profile.bestStreak}: ${user.longestStreak ?? user.currentStreak}`}
              >
                🔥 {user.currentStreak} {t.profile.streak}
              </span>
            )}
            {typeof user.coins === "number" && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
                >
                🪙 {user.coins}
              </span>
            )}
          </div>
        </div>
      </div>

      {typeof user.level === "number" && (
        <Card className="bg-card border border-border shadow-sm" data-testid="card-level">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" />
                {t.profile.level} {user.level}
              </span>
              <span className="text-xs font-mono text-muted-foreground" data-testid="text-xp">
                {user.xpIntoLevel ?? 0} / {user.xpForNextLevel ?? 0} {t.profile.xp}
              </span>
            </div>
            <Progress value={user.levelPct ?? 0} className="h-3" />
            <div className="text-[10px] text-muted-foreground mt-1 text-right">
              {Math.max(0, (user.xpForNextLevel ?? 0) - (user.xpIntoLevel ?? 0))} {t.profile.xp} {t.profile.xpToNext}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            { label: t.profile.totalTests, val: stats.totalTests, icon: Timer, testId: "status-total-tests" },
            { label: t.profile.bestWpm, val: stats.bestWpm, icon: Trophy, testId: "status-best-wpm" },
            { label: t.profile.avgWpm, val: stats.avgWpm, icon: BarChart3, testId: "status-avg-wpm" },
            { label: t.profile.avgAccuracy, val: `${stats.avgAccuracy}%`, icon: Target, testId: "status-avg-accuracy" },
          ] as const
        ).map((item, idx) => (
          <div key={idx} data-testid={item.testId}>
            <StatCard label={item.label} value={item.val} icon={item.icon} size="lg" />
          </div>
        ))}
      </div>

      {/* 4 languages: was md:grid-cols-3, which orphaned the 4th card. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {(['uz', 'ru', 'en', 'kaa'] as const).map((lang) => (
          <Card key={lang} className="overflow-hidden bg-card/50">
            <CardHeader className="bg-secondary/20 py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4 text-muted-foreground" />
                {lang === 'uz' ? t.leaderboard.uzbekRanking : lang === 'ru' ? t.leaderboard.russianRanking : lang === 'en' ? t.leaderboard.englishRanking : t.leaderboard.karakalpakRanking}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-3 divide-x divide-border">
                {[15, 30, 60].map((mode) => (
                  <div key={mode} className="p-4 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{mode} {t.typing.time.toLowerCase()}</div>
                    <div className="text-2xl font-mono font-bold text-foreground">
                      {data.detailedStats?.[lang as 'uz'|'ru'|'en'|'kaa']?.[mode.toString()] || 0}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.badges && (data.badges.earned.length > 0 || data.badges.locked.length > 0) && (
        <Card className="bg-card border border-border shadow-sm" data-testid="card-achievements">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              {t.profile.achievements}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {[
                ...data.badges.earned.map((b) => ({ ...b, earned: true })),
                ...data.badges.locked.map((b) => ({ ...b, earned: false })),
              ].map((b) => {
                const Icon = BADGE_ICONS[b.icon] ?? Trophy;
                const meta = (t.profile.badges as Record<string, { title: string; desc: string }>)[b.key];
                return (
                  <div
                    key={b.key}
                    title={meta ? `${meta.title} — ${meta.desc}` : b.key}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all",
                      b.earned
                        ? "bg-warning/5 border-warning/30"
                        : "bg-muted/30 border-border opacity-40 grayscale",
                    )}
                    data-testid={`badge-${b.key}`}
                  >
                    <div className="relative">
                      <Icon className={cn("w-6 h-6", b.earned ? "text-warning" : "text-muted-foreground")} />
                      {!b.earned && (
                        <Lock className="w-3 h-3 absolute -bottom-1 -right-1 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-tight">{meta?.title ?? b.key}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            {t.profile.performanceHistory}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <AppErrorBoundary
              scope="chart"
              fallback={({ error, reset }) => (
                <DefaultErrorFallback error={error} reset={reset} compact />
              )}
            >
              <ProgressChart data={chartData} />
            </AppErrorBoundary>
          </div>
        </CardContent>
      </Card>

      {isOwnProfile && (
        <Card className="bg-card border border-border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-muted-foreground" />
              {t.profile.profileSettings}
            </CardTitle>
            <CardDescription>{t.profile.manageProfile}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Your ID Section */}
            <div className="space-y-2 max-w-md pb-8 border-b border-border/50">
              <Label htmlFor="profile-own-id">{t.profile.yourId}</Label>
              <div className="flex gap-2">
                <Input
                  id="profile-own-id"
                  value={user.id}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 font-mono text-xs sm:text-sm"
                  data-testid="text-own-id"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleCopyId(user.id)}
                  className="font-bold shrink-0"
                  data-testid="button-copy-own-id"
                >
                  {idCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">{t.profile.yourIdDesc}</p>
            </div>

            {/* Nickname Section */}
            <div className="space-y-4 max-w-md pb-8 border-b border-border/50">
              <div className="space-y-2">
                <Label htmlFor="profile-nickname">{t.profile.nickname}</Label>
                <div className="flex gap-2">
                  <Input
                    id="profile-nickname"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder={`${t.profile.nickname}...`}
                    className="flex-1 font-mono"
                    maxLength={20}
                  />
                  <Button 
                    onClick={handleUpdateNickname} 
                    disabled={isUpdatingNick || newNickname === authUser?.firstName}
                    className="font-bold"
                  >
                    {isUpdatingNick ? "..." : t.profile.save}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 italic">
                  <AlertCircle className="w-3 h-3" />
                  {t.profile.wait90Days}
                </p>
              </div>
            </div>

            {/* Password Section */}
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{t.profile.passwordUpdate}</span>
              </div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-old-password">{t.profile.currentPassword}</Label>
                  <Input
                    id="profile-old-password"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder={t.profile.currentPassword}
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-new-password">{t.profile.newPassword}</Label>
                  <Input
                    id="profile-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.profile.passwordMin}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-confirm-password">{t.profile.confirmPassword}</Label>
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t.profile.confirmPlaceholder}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" disabled={isChangingPassword} className="w-full font-extrabold uppercase tracking-tight">
                {isChangingPassword ? "..." : t.profile.updatePasswordBtn}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {dailyActivity && dailyActivity.length > 0 && (
        <Card className="bg-card border border-border shadow-sm" data-testid="card-daily-activity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-muted-foreground" />
              {t.profile.dailyActivity}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[360px]">
                <TableHeader className="bg-secondary/40">
                  <TableRow>
                    <TableHead>{t.profile.date}</TableHead>
                    <TableHead>{t.profile.testsCount}</TableHead>
                    <TableHead>{t.profile.avgWpm}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyActivity.map((day) => (
                    <TableRow key={day.date} data-testid={`row-day-${day.date}`}>
                      <TableCell className="text-foreground">
                        {(() => {
                          // day.date is a plain "YYYY-MM-DD" string — parse as local
                          // components, not via `new Date(string)`, which reads
                          // date-only strings as UTC midnight and can shift the
                          // displayed day backward in timezones behind UTC.
                          const [y, m, d] = day.date.split("-").map(Number);
                          return format(new Date(y, m - 1, d), "MMM d, yyyy");
                        })()}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-foreground">{day.count}</TableCell>
                      <TableCell className="font-mono">{day.avgWpm}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            {t.profile.recentTests}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table className="min-w-[480px]">
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead>WPM</TableHead>
                <TableHead>{t.typing.accuracy}</TableHead>
                <TableHead>{t.leaderboard.language}</TableHead>
                <TableHead>{t.profile.mode}</TableHead>
                <TableHead>{t.profile.date}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentResults.map((result) => (
                <TableRow key={result.id} data-testid={`row-test-${result.id}`}>
                  <TableCell className="font-mono font-bold text-foreground">{result.wpm}</TableCell>
                  <TableCell className="font-mono">{result.accuracy}%</TableCell>
                  <TableCell className="uppercase">{result.language}</TableCell>
                  <TableCell>{result.mode}s</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(result.createdAt), "MMM d, yyyy HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
              {recentResults.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t.profile.noTests}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
