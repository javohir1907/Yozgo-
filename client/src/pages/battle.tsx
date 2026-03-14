import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useWebsocket } from "@/hooks/use-websocket";
import { TypingArea } from "@/components/typing-area";
import { BattleProgressBar } from "@/components/battle-progress-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Trophy, Users, Play, Copy, Loader2, Crown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function BattlePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [battleCode, setBattleCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [userInput, setUserInput] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { room, battleStart, battleEnd, error, sendReady, sendProgress } = useWebsocket(battleCode, user as any);


  // Countdown timer when battle starts
  useEffect(() => {
    if (battleStart && !battleEnd) {
      // battleStart.startTime is when battle started — show countdown from 3 to 0
      const now = Date.now();
      const elapsed = now - battleStart.startTime;
      const remaining = Math.max(0, 3000 - elapsed);
      
      if (remaining > 0) {
        setCountdown(Math.ceil(remaining / 1000));
        countdownRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [battleStart]);

  useEffect(() => {
    if (error) {
      toast({
        title: t.battle.error,
        description: error,
        variant: "destructive",
      });
      setBattleCode(null);
    }
  }, [error, toast]);

  const createBattle = async () => {
    setIsCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await apiRequest("POST", "/api/battles", {
        code,
        status: "waiting",
        language: "en",
        mode: "50",
      });
      setBattleCode(code);
      setIsAdmin(true); // Creator is admin
    } catch (err) {
      toast({
        title: t.battle.error,
        description: t.battle.failedCreate,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const joinBattle = () => {
    if (inputCode.trim()) {
      setBattleCode(inputCode.trim().toUpperCase());
      setIsAdmin(false);
    }
  };

  const handleInputChange = useCallback((value: string) => {
    if (!battleStart || battleEnd || countdown !== null) return;

    setUserInput(value);
    const currentWord = battleStart.words[currentIndex];

    if (value === currentWord + " ") {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setUserInput("");

      const progress = Math.min(Math.round((newIndex / battleStart.words.length) * 100), 100);
      const timeElapsed = (Date.now() - battleStart.startTime) / 60000;
      const currentWpm = Math.round(newIndex / timeElapsed);
      
      setWpm(currentWpm);
      sendProgress(progress, currentWpm);
    }
  }, [battleStart, battleEnd, currentIndex, sendProgress, countdown]);

  const copyCode = () => {
    if (battleCode) {
      navigator.clipboard.writeText(battleCode);
      toast({
        title: t.battle.copied,
        description: t.battle.copiedDesc,
      });
    }
  };

  // Admin starts battle manually
  const handleAdminStart = () => {
    sendReady();
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Users className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">{t.battle.signInTitle}</h2>
        <p className="text-muted-foreground">{t.battle.signInSubtitle}</p>
        <Button onClick={() => window.location.href = "/auth"}>
          {t.nav.signIn}
        </Button>
      </div>
    );
  }

  if (!battleCode) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center font-mono tracking-tighter">{t.battle.title}</h1>
        
        <div className="grid gap-6">
          <Card className="hover-elevate transition-all border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                {t.battle.createBattle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{t.battle.createDesc}</p>
              <Button onClick={createBattle} disabled={isCreating} className="w-full">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t.battle.createRoom}
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate transition-all border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t.battle.joinBattle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input 
                  placeholder={t.battle.enterCode}
                  value={inputCode} 
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinBattle()}
                  className="font-mono uppercase"
                  data-testid="input-battle-code"
                />
                <Button onClick={joinBattle} data-testid="button-join-battle">{t.battle.join}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono">BATTLE: {battleCode}</h1>
          <p className="text-muted-foreground">{t.battle.mode} 50 Words • Language: EN
            {isAdmin && (
              <span className="ml-2 inline-flex items-center gap-1 text-yellow-500 text-xs font-semibold">
                <Crown className="w-3 h-3" /> Admin
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyCode} className="flex items-center gap-2">
            <Copy className="w-4 h-4" />
            {t.battle.copyCode}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setBattleCode(null)}>
            {t.battle.leaveRoom}
          </Button>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Players list — always visible, real-time */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t.battle.players} ({room?.players?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!room?.players || room.players.length === 0) ? (
              <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">{t.battle.waiting}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {room.players.map((player: any) => (
                  <BattleProgressBar
                    key={player.id}
                    username={player.username}
                    avatarUrl={player.avatarUrl}
                    progress={player.progress}
                    wpm={player.wpm}
                    isMe={player.id === user.id}
                    youLabel={t.battle.you}
                  />
                ))}
              </div>
            )}
            
            {room?.status === "waiting" && (
              <div className="flex flex-col items-center justify-center py-6 gap-4 border-t mt-4">
                <p className="text-muted-foreground text-sm">
                  {(room?.players?.length ?? 0) < 2
                    ? t.battle.waiting
                    : t.battle.ready}
                </p>

                {/* Admin: Start battle button */}
                {isAdmin ? (
                  <Button
                    onClick={handleAdminStart}
                    className="w-full max-w-xs bg-primary hover:bg-primary/90 font-bold"
                    disabled={room.players.find((p: any) => p.id === user.id)?.isReady}
                    data-testid="button-admin-start"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {room.players.find((p: any) => p.id === user.id)?.isReady
                      ? t.battle.readyStatus
                      : "Jangni boshlash"}
                  </Button>
                ) : (
                  <Button
                    onClick={sendReady}
                    disabled={room.players.find((p: any) => p.id === user.id)?.isReady}
                    variant={room.players.find((p: any) => p.id === user.id)?.isReady ? "secondary" : "default"}
                    className="w-full max-w-xs"
                    data-testid="button-ready"
                  >
                    {room.players.find((p: any) => p.id === user.id)?.isReady ? t.battle.readyStatus : t.battle.imReady}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Countdown overlay */}
        {battleStart && countdown !== null && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center animate-in zoom-in duration-300">
              <div className="text-9xl font-black font-mono text-primary animate-pulse">
                {countdown}
              </div>
              <p className="text-xl text-muted-foreground mt-4">Tayyor bo'ling!</p>
            </div>
          </div>
        )}

        {/* Typing area */}
        {battleStart && !battleEnd && countdown === null && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center">
              <span className="text-4xl font-bold font-mono text-primary">{wpm}</span>
              <span className="text-muted-foreground ml-2">WPM</span>
            </div>
            
            <TypingArea
              words={battleStart.words}
              userInput={userInput}
              onInputChange={handleInputChange}
              onComplete={() => {}}
              isActive={true}
              currentIndex={currentIndex}
            />
          </div>
        )}

        {battleEnd && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <CardHeader className="text-center">
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <CardTitle className="text-3xl font-bold">
                  {battleEnd.winnerId === user.id ? t.battle.victory : t.battle.defeat}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {battleEnd.results.map((result: any) => (
                    <div key={result.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="font-bold flex items-center gap-2">
                        {result.id === battleEnd.winnerId && <Trophy className="w-4 h-4 text-yellow-500" />}
                        {result.username}
                      </span>
                      <span className="font-mono text-primary font-bold">{result.wpm} WPM</span>
                    </div>
                  ))}
                </div>
                <Button onClick={() => window.location.reload()} className="w-full">
                  {t.battle.playAgain}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
