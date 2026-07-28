import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield,
  ShieldHalf,
  Medal,
  Award,
  Gem,
  Crown,
  ChevronUp,
  ChevronDown,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/page-shell";
import { AuthGate } from "@/components/common/auth-gate";
import { QueryBoundary } from "@/components/common/query-boundary";
import { UserRow } from "@/components/common/user-row";
import { EmptyState } from "@/components/common/empty-state";
import { ListSkeleton } from "@/components/common/skeletons";

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

  const query = useQuery<LeagueStanding>({
    queryKey: ["/api/league/me"],
    enabled: isAuthenticated,
  });
  const data = query.data;

  const TierIcon = data ? (TIER_ICONS[data.tierIcon] ?? Shield) : Shield;
  const tierName = data
    ? ((t.leaderboard.leagueTiers as Record<string, string>)[data.tierKey] ?? data.tierName)
    : "";

  return (
    <PageShell size="md" seo={{ title: t.leaderboard.leagueTitle }}>
      <AuthGate title={t.leaderboard.leagueTitle}>
        <QueryBoundary
          query={query}
          loading={<ListSkeleton rows={8} />}
          isEmpty={!!data && data.members.length === 0}
          empty={<EmptyState icon={Shield} title={t.leaderboard.leagueEmpty} />}
        >
          {data && (
            <div className="space-y-6">
              <header className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <TierIcon className="h-8 w-8 text-primary" aria-hidden="true" />
                </span>
                <h1
                  className="font-heading text-3xl font-extrabold tracking-tight"
                  data-testid="text-league-tier"
                >
                  {tierName}
                </h1>
                <p className="text-sm text-muted-foreground">{t.leaderboard.leagueTitle}</p>
              </header>

              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {data.members.map((m) => {
                    const isMe = m.userId === user?.id;
                    const inPromotion =
                      m.rank <= data.promoteCount && data.promoteCount > 0;
                    const inRelegation =
                      m.rank > data.cohortSize - data.relegateCount &&
                      data.relegateCount > 0;
                    const showPromoDivider =
                      data.promoteCount > 0 && m.rank === data.promoteCount;
                    const showRelegDivider =
                      data.relegateCount > 0 &&
                      m.rank === data.cohortSize - data.relegateCount + 1;

                    return (
                      <div key={m.userId}>
                        {showRelegDivider && (
                          <ZoneDivider tone="danger" icon={ChevronDown}>
                            {t.leaderboard.relegationZone}
                          </ZoneDivider>
                        )}
                        <div
                          className={cn(
                            "border-b border-border/50 last:border-0",
                            isMe && "bg-primary/5",
                            inPromotion && "border-l-2 border-l-success",
                            inRelegation && "border-l-2 border-l-destructive",
                          )}
                          data-testid={`league-row-${m.rank}`}
                        >
                          <UserRow
                            user={{
                              id: m.userId,
                              username: m.username,
                              avatarUrl: m.avatarUrl,
                            }}
                            size="sm"
                            highlight={isMe}
                            rank={
                              <span className="flex items-center justify-center gap-0.5">
                                {inPromotion && (
                                  <ChevronUp
                                    className="h-3 w-3 text-success"
                                    aria-label={t.leaderboard.promotionZone}
                                  />
                                )}
                                {inRelegation && (
                                  <ChevronDown
                                    className="h-3 w-3 text-destructive"
                                    aria-label={t.leaderboard.relegationZone}
                                  />
                                )}
                                {m.rank}
                              </span>
                            }
                            trailing={
                              <span className="flex items-center gap-1 font-mono text-sm font-bold tabular-nums">
                                <Trophy
                                  className="h-3 w-3 text-warning"
                                  aria-hidden="true"
                                />
                                {m.weeklyXp}
                              </span>
                            }
                          />
                        </div>
                        {showPromoDivider && (
                          <ZoneDivider tone="success" icon={ChevronUp}>
                            {t.leaderboard.promotionZone}
                          </ZoneDivider>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <p className="text-center text-xs text-muted-foreground">
                {t.leaderboard.weeklyXpShort}
              </p>
            </div>
          )}
        </QueryBoundary>
      </AuthGate>
    </PageShell>
  );
}

function ZoneDivider({
  tone,
  icon: Icon,
  children,
}: {
  tone: "success" | "danger";
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-1 text-2xs font-bold uppercase tracking-wider",
        tone === "success" ? "bg-success/5 text-success" : "bg-destructive/5 text-destructive",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {children}
    </div>
  );
}
