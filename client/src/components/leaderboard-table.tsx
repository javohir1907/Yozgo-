import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  return (
    <div className="rounded-md border bg-card" data-testid="leaderboard-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Rank</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="text-right">WPM</TableHead>
            <TableHead className="text-right">Accuracy</TableHead>
            <TableHead className="text-right">Language</TableHead>
            <TableHead className="text-right">Date</TableHead>
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
