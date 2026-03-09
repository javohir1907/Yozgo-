import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LanguageSelector, type Language } from "@/components/language-selector";
import { Loader2, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl?: string;
  wpm: number;
  accuracy: number;
  language: string;
  date: string;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<string>("alltime");
  const [language, setLanguage] = useState<Language>("en");

  const { data: entries, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/leaderboard?period=${period}&language=${language}`],
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-bold tracking-tight" data-testid="text-leaderboard-title">Leaderboard</h1>
          </div>
          <p className="text-muted-foreground">
            Top typists across the globe. Can you make it to the top?
          </p>
        </header>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-lg border">
          <Tabs 
            value={period} 
            onValueChange={setPeriod} 
            className="w-full md:w-auto"
          >
            <TabsList data-testid="tabs-leaderboard-period">
              <TabsTrigger value="daily" data-testid="button-period-daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly" data-testid="button-period-weekly">Weekly</TabsTrigger>
              <TabsTrigger value="alltime" data-testid="button-period-alltime">All-time</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Language:</span>
            <LanguageSelector 
              currentLanguage={language} 
              onLanguageChange={(lang) => setLanguage(lang)} 
            />
          </div>
        </div>

        <div className="min-h-[400px] relative">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center absolute inset-0"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Fetching rankings...</p>
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {entries && entries.length > 0 ? (
                  <LeaderboardTable entries={entries} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-card">
                    <p className="text-muted-foreground">No records found for this period and language.</p>
                    <p className="text-sm text-muted-foreground/70">Be the first to set a record!</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
