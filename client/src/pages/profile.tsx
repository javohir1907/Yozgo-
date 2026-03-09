import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trophy, Target, Timer, BarChart3, History } from "lucide-react";
import { format } from "date-fns";

interface ProfileData {
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  stats: {
    totalTests: number;
    avgWpm: number;
    bestWpm: number;
    avgAccuracy: number;
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
  const { user: authUser } = useAuth();
  
  const { data, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile", authUser?.id],
    enabled: !!authUser?.id,
  });

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

  const chartData = [...recentResults]
    .reverse()
    .map((r) => ({
      date: format(new Date(r.createdAt), "MMM d"),
      wpm: r.wpm,
      accuracy: r.accuracy,
    }));

  return (
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
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
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Typing Enthusiast
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Total Tests
            </CardTitle>
            <Timer className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold" data-testid="status-total-tests">
              {stats.totalTests}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Best WPM
            </CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold" data-testid="status-best-wpm">
              {stats.bestWpm}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Avg. WPM
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold" data-testid="status-avg-wpm">
              {stats.avgWpm}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 hover-elevate transition-all">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Avg. Accuracy
            </CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold" data-testid="status-avg-accuracy">
              {stats.avgAccuracy}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Performance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ProgressChart data={chartData} />
          </div>
        </CardContent>
      </Card>

      {/* Recent History */}
      <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Recent Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WPM</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Date</TableHead>
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
                    No tests completed yet.
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
