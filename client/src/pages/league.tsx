import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Shield,
  ShieldHalf,
  Medal,
  Award,
  Gem,
  Crown,
  ChevronUp,
  ChevronDown,
  Loader2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";

interface LeagueStanding {
  tier: number;
  tierKey: string;
  tierName: string;
  tierIcon: string;
  promoteCount: number;
  relegateCount: number;
  cohortSize: number;
  me: { userId: string; rank: number; weeklyXp: number } | null;
  members: {
    userId: string;
    username: string;
    avatarUrl: string | null;
    weeklyXp: number;
    rank: number;
  }[];
}

const TIER_ICONS: Record<string, LucideIcon> = { Shield, ShieldHalf, Medal, Award, Gem, Crown };

export default function LeaguePage() {
  const { t } = useI18n();
  const { user, isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<LeagueStanding>({
    queryKey: ["/api/league/me"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-8 text-center text-muted-foreground">
        {t.leaderboard.leagueEmpty}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const TierIcon = TIER_ICONS[data.tierIcon] ?? Shield;
  const tierName =
    (t.leaderboard.leagueTiers as Record<string, string>)[data.tierKey] ?? data.tierName;
  const size = data.cohortSize;

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-3xl space-y-6 animate-in fade-in duration-500">
      <SEO title={`${t.leaderboard.leagueTitle} | YOZGO`} description={t.leaderboard.leagueTitle} />

      <header className="flex flex-col items-center gap-2 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <TierIcon className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-league-tier">
          {tierName}
        </h1>
        <p className="text-sm text-muted-foreground">{t.leaderboard.leagueTitle}</p>
      </header>

      <Card className="bg-card border border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {data.members.map((m) => {
            const isMe = m.userId === user?.id;
            const inPromotion = m.rank <= data.promoteCount && data.promoteCount > 0;
            const inRelegation =
              m.rank > size - data.relegateCount && data.relegateCount > 0;
            const showPromoDivider = data.promoteCount > 0 && m.rank === data.promoteCount;
            const showRelegDivider =
              data.relegateCount > 0 && m.rank === size - data.relegateCount + 1;

            return (
              <div key={m.userId}>
                {showRelegDivider && (
                  <div className="flex items-center gap-2 px-4 py-1 bg-red-500/5 text-red-500 text-[10px] font-bold uppercase tracking-wider">
                    <ChevronDown className="w-3 h-3" />
                    {t.leaderboard.relegationZone}
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0",
                    isMe && "bg-primary/5",
                    inPromotion && "border-l-2 border-l-green-500",
                    inRelegation && "border-l-2 border-l-red-500",
                  )}
                  data-testid={`league-row-${m.rank}`}
                >
                  <span
                    className={cn(
                      "w-6 text-center font-mono font-bold text-sm",
                      inPromotion ? "text-green-500" : inRelegation ? "text-red-500" : "text-muted-foreground",
                    )}
                  >
                    {m.rank}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {m.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn("flex-1 font-medium truncate", isMe && "text-primary font-bold")}>
                    {m.username}
                  </span>
                  <span className="font-mono font-bold text-sm flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-yellow-500" />
                    {m.weeklyXp}
                  </span>
                </div>
                {showPromoDivider && (
                  <div className="flex items-center gap-2 px-4 py-1 bg-green-500/5 text-green-500 text-[10px] font-bold uppercase tracking-wider">
                    <ChevronUp className="w-3 h-3" />
                    {t.leaderboard.promotionZone}
                  </div>
                )}
              </div>
            );
          })}
          {data.members.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">{t.leaderboard.leagueEmpty}</div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">{t.leaderboard.weeklyXpShort}</p>
    </div>
  );
}
