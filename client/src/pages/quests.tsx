import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Type,
  Target,
  Repeat,
  Swords,
  Users,
  CheckCircle2,
  Loader2,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";

interface QuestsResponse {
  date: string;
  quests: {
    key: string;
    icon: string;
    xpReward: number;
    target: number;
    progress: number;
    completed: boolean;
  }[];
  allCompleted: boolean;
}

const QUEST_ICONS: Record<string, LucideIcon> = { Type, Target, Repeat, Swords, Users };

export default function QuestsPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<QuestsResponse>({
    queryKey: ["/api/quests"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">{t.leaderboard.questsTitle}</h1>
        <p className="text-muted-foreground">{t.leaderboard.leagueEmpty}</p>
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

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-2xl space-y-6 animate-in fade-in duration-500">
      <SEO title={`${t.leaderboard.questsTitle} | YOZGO`} description={t.leaderboard.questsTitle} />

      <header className="flex items-center gap-3">
        <ListChecks className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">{t.leaderboard.questsTitle}</h1>
      </header>

      {data.allCompleted && (
        <div
          className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-center font-bold text-green-600"
          data-testid="banner-all-done"
        >
          {t.leaderboard.questAllDone}
        </div>
      )}

      <div className="space-y-4">
        {data.quests.map((q) => {
          const Icon = QUEST_ICONS[q.icon] ?? ListChecks;
          const label = (t.leaderboard.questsList as Record<string, string>)[q.key] ?? q.key;
          const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
          return (
            <Card
              key={q.key}
              className={cn("border border-border", q.completed && "border-green-500/40 bg-green-500/5")}
              data-testid={`quest-${q.key}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={cn("w-5 h-5", q.completed ? "text-green-500" : "text-primary")} />
                  <span className="flex-1 font-medium">{label}</span>
                  {q.completed ? (
                    <span className="text-green-600 flex items-center gap-1 text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4" /> +{q.xpReward} XP
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                      {q.progress}/{q.target} · +{q.xpReward} XP
                    </span>
                  )}
                </div>
                <Progress value={pct} className="h-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
