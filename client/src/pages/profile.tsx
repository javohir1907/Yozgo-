import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProgressChart } from "@/components/progress-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Target, Timer, BarChart3, History, Key, AlertCircle, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";

interface ProfileData {
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
    gender?: string;
    role?: string;
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
  };
  recentResults: {
    id: string;
    wpm: number;
    accuracy: number;
    language: string;
    mode: string;
    createdAt: string;
  }[];
}

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const { user: authUser } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();

  const currentUserId = params?.userId || authUser?.id;
  const isOwnProfile = !params?.userId || params.userId === authUser?.id;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [newNickname, setNewNickname] = useState(authUser?.firstName || "");
  const [isUpdatingNick, setIsUpdatingNick] = useState(false);

  const handleUpdateNickname = async () => {
    if (!newNickname || newNickname.length < 4) {
      return toast({ variant: "destructive", title: "Nickname juda qisqa" });
    }
    
    setIsUpdatingNick(true);
    try {
      const res = await apiRequest("POST", "/api/auth/update-nickname", { newNickname });
      const data = await res.json();
      
      if (res.ok) {
        toast({ title: "Muvaffaqiyatli", description: data.message });
        window.location.reload(); 
      } else {
        toast({ variant: "destructive", title: "Xatolik", description: data.message });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Xatolik", description: err.message });
    } finally {
      setIsUpdatingNick(false);
    }
  };

  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: [currentUserId ? `/api/profile/${currentUserId}` : "/api/profile/me"], // Changed to actual endpoint
    enabled: !!currentUserId,
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== currentPassword) {
      toast({
        title: "Xatolik",
        description: "Kiritilgan parollar bir-biriga mos kelmadi",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Xatolik",
        description: "Yangi parol kamida 6ta belgidan iborat bo'lishi kerak",
        variant: "destructive",
      });
      return;
    }
    setIsChangingPassword(true);
    try {
      await apiRequest("POST", "/api/auth/update-password", {
        newPassword,
      });
      toast({
        title: "Muvaffaqiyatli",
        description: "Parolingiz o'zgartirildi",
      });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      toast({
        title: "Xatolik",
        description: err.message || "Parolni o'zgartirish amalga oshmadi",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-6 mb-8">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const { user, stats, recentResults } = data;

  const chartData = [...recentResults].reverse().map((r) => ({
    date: format(new Date(r.createdAt), "MMM d"),
    wpm: r.wpm,
    accuracy: r.accuracy,
  }));

  return (
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <SEO 
        title={`${user.username} | Profil`} 
        description={`${user.username}ning YOZGO platformasidagi natijalari va statistikasi.`}
      />
      
      <div className="flex items-center gap-6 mb-8">
        <Avatar className="h-24 w-24 border-2 border-primary/20">
          <AvatarImage src={user.avatarUrl} />
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
              {t.profile.typingEnthusiast}
            </p>
            {user.gender && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                user.gender === 'male' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-pink-500/10 text-pink-500 border-pink-500/20"
              )}>
                {user.gender === 'male' ? "O'g'il bola" : "Qiz bola"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: t.profile.totalTests, val: stats.totalTests, icon: Timer, color: "text-primary", testId: "status-total-tests" },
          { label: t.profile.bestWpm, val: stats.bestWpm, icon: Trophy, color: "text-yellow-500", testId: "status-best-wpm" },
          { label: t.profile.avgWpm, val: stats.avgWpm, icon: BarChart3, color: "text-blue-500", testId: "status-avg-wpm" },
          { label: t.profile.avgAccuracy, val: `${stats.avgAccuracy}%`, icon: Target, color: "text-green-500", testId: "status-avg-accuracy" },
        ].map((item, idx) => (
          <Card key={idx} className="bg-card border border-border shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {item.label}
              </CardTitle>
              <item.icon className={cn("h-4 w-4", item.color)} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold" data-testid={item.testId}>
                {item.val}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['uz', 'ru', 'en'].map((lang) => (
          <Card key={lang} className="overflow-hidden border-border bg-card/50">
            <CardHeader className="bg-secondary/20 py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
                <Trophy className={cn("w-4 h-4", lang === 'uz' ? "text-blue-500" : lang === 'ru' ? "text-red-500" : "text-green-500")} />
                {lang === 'uz' ? "O'zbek" : lang === 'ru' ? "Rus" : "Ingliz"} tili rekordlari
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-3 divide-x divide-border">
                {[15, 30, 60].map((mode) => (
                  <div key={mode} className="p-4 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{mode} soniya</div>
                    <div className="text-2xl font-mono font-bold text-primary">
                      {data.detailedStats?.[lang as 'uz'|'ru'|'en']?.[mode.toString()] || 0}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {t.profile.performanceHistory}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ProgressChart data={chartData} />
          </div>
        </CardContent>
      </Card>

      {isOwnProfile && (
        <Card className="bg-card border border-border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-primary" />
              Profil Sozlamalari
            </CardTitle>
            <CardDescription>Nickname va parolni boshqarish</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Nickname Section */}
            <div className="space-y-4 max-w-md pb-8 border-b border-border/50">
              <div className="space-y-2">
                <Label>Nickname (Foydalanuvchi nomi)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="Yangi nickname..."
                    className="flex-1 font-mono"
                    maxLength={20}
                  />
                  <Button 
                    onClick={handleUpdateNickname} 
                    disabled={isUpdatingNick || newNickname === authUser?.firstName}
                    className="btn-3d font-bold"
                  >
                    {isUpdatingNick ? "..." : "Saqlash"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 italic">
                  <AlertCircle className="w-3 h-3" />
                  Nicknameni har 90 kunda bir marta o'zgartirish mumkin.
                </p>
              </div>
            </div>

            {/* Password Section */}
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Parolni Yangilash</span>
              </div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Yangi parol</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kamida 6 ta belgi"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parolni tasdiqlang</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Qayta kiriting"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" disabled={isChangingPassword} className="w-full font-extrabold uppercase tracking-tight">
                {isChangingPassword ? "Yangilanmoqda..." : "Parolni Tasdiqlash"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            {t.profile.recentTests}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
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
                  <TableCell className="font-mono font-bold text-primary">{result.wpm}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
