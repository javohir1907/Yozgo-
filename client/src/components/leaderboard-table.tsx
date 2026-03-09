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

interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl?: string;
  wpm: number;
  accuracy: number;
  language: string;
  date: string;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const { t } = useI18n();

  return (
    <div className="rounded-md border bg-card" data-testid="leaderboard-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">{t.leaderboard.rank}</TableHead>
            <TableHead>{t.leaderboard.user}</TableHead>
            <TableHead className="text-right">WPM</TableHead>
            <TableHead className="text-right">{t.leaderboard.accuracy}</TableHead>
            <TableHead className="text-right">{t.leaderboard.language}</TableHead>
            <TableHead className="text-right">{t.leaderboard.date}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={`${entry.rank}-${entry.username}`} data-testid={`row-user-${entry.username}`}>
              <TableCell className="font-mono">#{entry.rank}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.username} />}
                    <AvatarFallback>{entry.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium" data-testid={`text-username-${entry.username}`}>{entry.username}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono" data-testid={`text-wpm-${entry.username}`}>{entry.wpm}</TableCell>
              <TableCell className="text-right font-mono" data-testid={`text-accuracy-${entry.username}`}>{entry.accuracy}%</TableCell>
              <TableCell className="text-right uppercase text-xs text-muted-foreground font-mono">{entry.language}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">{entry.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
