import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { LeaderboardEntry } from "@/pages/leaderboard";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} soat ${m} daq`;
  return `${m} daq`;
}

export function LeaderboardTable({ entries, currentUserId }: LeaderboardTableProps) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border bg-card" data-testid="leaderboard-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px] text-center">#</TableHead>
            <TableHead>Foydalanuvchi</TableHead>
            <TableHead className="text-right">Avg WPM</TableHead>
            <TableHead className="text-right">Best WPM</TableHead>
            <TableHead className="text-right">Accuracy</TableHead>
            <TableHead className="text-right">Testlar soni</TableHead>
            <TableHead className="text-right">Jami vaqt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const isCurrentUser = currentUserId && entry.userId === currentUserId;
            const progress = Math.min((entry.totalSeconds / 1800) * 100, 100);
            const needsProgress = entry.totalSeconds < 1800;
            const minutesLeft = Math.ceil((1800 - entry.totalSeconds) / 60);

            return (
              <TableRow
                key={`${entry.rank}-${entry.userId}`}
                className={cn(isCurrentUser && "bg-primary/10")}
                data-testid={`row-user-${entry.username}`}
              >
                <TableCell className="font-mono text-center font-bold">
                  {needsProgress ? "-" : entry.rank}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {entry.avatarUrl && (
                          <AvatarImage src={entry.avatarUrl} alt={entry.username} />
                        )}
                        <AvatarFallback>
                          {entry.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium" data-testid={`text-username-${entry.username}`}>
                        {entry.username}
                      </span>
                    </div>
                    {needsProgress && (
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground w-full max-w-[200px]">
                        <div className="flex justify-between">
                          <span>Reytingga kirish</span>
                          <span>
                            {Math.round(progress)}% ({minutesLeft} daq qoldi)
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {entry.avgWpm}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">
                  {entry.bestWpm}
                </TableCell>
                <TableCell className="text-right font-mono">{entry.accuracy}%</TableCell>
                <TableCell className="text-right text-muted-foreground font-mono">
                  {entry.testCount}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatTime(entry.totalSeconds)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
