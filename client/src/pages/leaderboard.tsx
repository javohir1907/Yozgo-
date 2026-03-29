import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import SEO from "@/components/SEO";

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
  const { t } = useI18n();
  const { user } = useAuth();

  const { data: entries, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/leaderboard?language=${language}`],
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <SEO title="Reyting | YOZGO" description="Eng tez yozuvchilar peshqadamlar jadvali. O'z o'rningizni toping va natijangizni yaxshilang." />
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-bold tracking-tight" data-testid="text-leaderboard-title">
              Reyting
            </h1>
          </div>
          <p className="text-muted-foreground">
            Eng tez yozuvchilar qatorida o'z o'rningizni toping. Reytingga to'liq kirish uchun jami
            30 daqiqa yozish tajribasiga ega bo'lishingiz kerak.
          </p>
        </header>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-lg border">
          <Tabs value={language} onValueChange={setLanguage} className="w-full md:w-auto">
            <TabsList data-testid="tabs-leaderboard-language">
              <TabsTrigger value="all">Hammasi</TabsTrigger>
              <TabsTrigger value="uz">UZ</TabsTrigger>
              <TabsTrigger value="ru">RU</TabsTrigger>
              <TabsTrigger value="en">EN</TabsTrigger>
            </TabsList>
          </Tabs>
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
                <p className="mt-2 text-sm text-muted-foreground">
                  {t.leaderboard.fetchingRankings}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {(() => {
                  if (!entries) return null;
                  const validEntries = entries.filter((e) => e.totalSeconds >= 1800);
                  const myEntry = entries.find((e) => e.userId === user?.id && e.totalSeconds < 1800);
                  
                  const displayEntries = [...validEntries];
                  if (myEntry) displayEntries.push(myEntry);

                  if (displayEntries.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed rounded-xl bg-card/50">
                        <Trophy className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <p className="text-xl text-muted-foreground font-medium">Hali hech kim reytingga kirish uchun yetarli vaqt to'plamagan.</p>
                        <p className="text-muted-foreground/70 mt-2">Sizda reytingga kiradigan birinchi foydalanuvchi bo'lish imkoni bor (30 daqiqa yozing)!</p>
                      </div>
                    );
                  }

                  const displayEntriesRanked = displayEntries.map((e, index) => ({
                    ...e,
                    rank: e.totalSeconds >= 1800 ? index + 1 : e.rank
                  }));

                  return <LeaderboardTable entries={displayEntriesRanked} currentUserId={user?.id} />;
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
