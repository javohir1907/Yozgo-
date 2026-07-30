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
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/layout/page-shell";
import { AuthGate } from "@/components/common/auth-gate";
import { QueryBoundary } from "@/components/common/query-boundary";
import { InlineAlert } from "@/components/common/inline-alert";
import { ListSkeleton } from "@/components/common/skeletons";

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

  const query = useQuery<QuestsResponse>({
    queryKey: ["/api/quests"],
    enabled: isAuthenticated,
  });

  return (
    <PageShell
      size="sm"
      icon={ListChecks}
      title={t.leaderboard.questsTitle}
      seo={{ title: t.leaderboard.questsTitle }}
    >
      <AuthGate title={t.leaderboard.questsTitle}>
        <QueryBoundary query={query} loading={<ListSkeleton rows={4} />}>
          {query.data && (
            <>
              {query.data.allCompleted && (
                <InlineAlert tone="success">{t.leaderboard.questAllDone}</InlineAlert>
              )}
              <div className="space-y-4">
                {query.data.quests.map((q) => {
                  const Icon = QUEST_ICONS[q.icon] ?? ListChecks;
                  const label =
                    (t.leaderboard.questsList as Record<string, string>)[q.key] ?? q.key;
                  // target can be 0 for a malformed quest — guard the divide.
                  const pct =
                    q.target > 0
                      ? Math.min(100, Math.round((q.progress / q.target) * 100))
                      : 0;
                  return (
                    <Card
                      key={q.key}
                      className={cn(q.completed && "border-success/40 bg-success/5")}
                      data-testid={`quest-${q.key}`}
                    >
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-center gap-3">
                          <Icon
                            className={cn(
                              "h-5 w-5 shrink-0",
                              q.completed ? "text-success" : "text-primary",
                            )}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 font-medium">{label}</span>
                          {q.completed ? (
                            <span className="flex items-center gap-1 text-sm font-bold text-success">
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> +
                              {q.xpReward} XP
                            </span>
                          ) : (
                            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                              {q.progress}/{q.target} · +{q.xpReward} XP
                            </span>
                          )}
                        </div>
                        <Progress
                          value={pct}
                          className="h-2"
                          aria-label={label}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </QueryBoundary>
      </AuthGate>
    </PageShell>
  );
}
