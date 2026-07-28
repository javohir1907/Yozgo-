import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/layout/page-shell";
import { QueryBoundary } from "@/components/common/query-boundary";
import { EmptyState } from "@/components/common/empty-state";
import { TableSkeleton } from "@/components/common/skeletons";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  avgWpm: number;
  bestWpm: number;
  accuracy: number;
  testCount: number;
  totalSeconds: number;
}

export default function LeaderboardPage() {
  const [language, setLanguage] = useState<string>("all");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "all">("all");
  const [mode, setMode] = useState<"global" | "friends">("global");
  const { t } = useI18n();
  const { user } = useAuth();

  const query = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/leaderboard?language=${language}&period=${period}&mode=${mode}`],
  });

  // A qualifying-time floor scaled by period: a weekly board at 30 min would be
  // nearly empty, so shorter periods use a lower threshold.
  const minSeconds = period === "weekly" ? 300 : period === "monthly" ? 600 : 1800;

  // Was an IIFE inside JSX; hoisted so the render body reads top-to-bottom.
  const rows = useMemo(() => {
    const entries = query.data;
    if (!entries) return [];
    const valid = entries.filter((e) => e.totalSeconds >= minSeconds);
    const mine = entries.find(
      (e) => e.userId === user?.id && e.totalSeconds < minSeconds,
    );
    const display = mine ? [...valid, mine] : valid;
    return display.map((e, i) => ({
      ...e,
      rank: e.totalSeconds >= minSeconds ? i + 1 : e.rank,
    }));
  }, [query.data, minSeconds, user?.id]);

  return (
    <PageShell
      size="lg"
      icon={Trophy}
      title={t.leaderboard.title}
      description={t.leaderboard.subtitle}
      seo={{ title: t.leaderboard.title, description: t.leaderboard.subtitle }}
    >
      <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-secondary/50 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <Tabs value={language} onValueChange={setLanguage} className="w-full md:w-auto">
          <TabsList data-testid="tabs-leaderboard-language" className="w-full md:w-auto">
            <TabsTrigger value="all">{t.leaderboard.all}</TabsTrigger>
            <TabsTrigger value="uz">UZ</TabsTrigger>
            <TabsTrigger value="kaa">KAA</TabsTrigger>
            <TabsTrigger value="ru">RU</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as "weekly" | "monthly" | "all")}
          className="w-full md:w-auto"
        >
          <TabsList data-testid="tabs-leaderboard-period" className="w-full md:w-auto">
            <TabsTrigger value="weekly">{t.leaderboard.weekly}</TabsTrigger>
            <TabsTrigger value="monthly">{t.leaderboard.monthly}</TabsTrigger>
            <TabsTrigger value="all">{t.leaderboard.allTime}</TabsTrigger>
          </TabsList>
        </Tabs>
        {user && (
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "global" | "friends")}
            className="w-full md:w-auto"
          >
            <TabsList data-testid="tabs-leaderboard-mode" className="w-full md:w-auto">
              <TabsTrigger value="global">{t.leaderboard.globalTab}</TabsTrigger>
              <TabsTrigger value="friends">{t.leaderboard.friendsTab}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="min-h-[400px]">
        <QueryBoundary
          query={query}
          loading={<TableSkeleton rows={8} cols={5} />}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={Trophy}
              title={t.leaderboard.noRecords}
              description={t.leaderboard.beFirst}
            />
          }
        >
          <LeaderboardTable
            entries={rows}
            currentUserId={user?.id}
            minSeconds={minSeconds}
          />
        </QueryBoundary>
      </div>
    </PageShell>
  );
}
