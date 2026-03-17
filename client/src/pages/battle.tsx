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
import { Trophy, Users, Play, Copy, Loader2, Crown, Timer, Settings, RotateCcw, Flame } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

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
  const [accuracy, setAccuracy] = useState(100);
  const [isCreating, setIsCreating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [attemptTimer, setAttemptTimer] = useState<number | null>(null);
  const [totalTimer, setTotalTimer] = useState<number | null>(null);
  const [isAttemptActive, setIsAttemptActive] = useState(false);
  
  // Settings (State managed by admin, synced via room object basically)
  const [testDuration, setTestDuration] = useState(30);
  const [totalTime, setTotalTime] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(5);

  const { 
    room, 
    battleStart, 
    battleEnd, 
    leadingPlayerId,
    error, 
    isConnected,
    startBattle, 
    submitResult, 
    sendProgress 
  } = useWebsocket(battleCode, user as any);

  const isAdmin = room?.adminId === user?.id;

  // Handle errors
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

  // Handle countdown when battle starts
  useEffect(() => {
    if (battleStart) {
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            startTotalTimer();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [battleStart]);

  const startTotalTimer = () => {
    if (!battleStart) return;
    const end = battleStart.endTime;
    const update = () => {
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTotalTimer(remaining);
      if (remaining > 0) {
        requestAnimationFrame(update);
      }
    };
    update();
  };

  // Handle attempt timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAttemptActive && attemptTimer !== null && attemptTimer > 0) {
      timer = setTimeout(() => {
        setAttemptTimer(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (isAttemptActive && attemptTimer === 0) {
      endAttempt();
    }
    return () => clearTimeout(timer);
  }, [isAttemptActive, attemptTimer]);

  const startAttempt = () => {
    if (!battleStart || totalTimer === 0) return;
    setIsAttemptActive(true);
    setAttemptTimer(battleStart.settings.testDuration);
    setUserInput("");
    setCurrentIndex(0);
    setWpm(0);
  };

  const endAttempt = () => {
    setIsAttemptActive(false);
    setAttemptTimer(null);
    if (wpm > 0) {
      submitResult(wpm, accuracy, 100);
      toast({
        title: "Urinish yakunlandi!",
        description: `${wpm} WPM natija qayd etildi.`,
      });
    }
  };

  const createBattle = async () => {
    setIsCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await apiRequest("POST", "/api/battles", {
        code,
        status: "waiting",
        language: "uz",
        mode: "50",
      });
      setBattleCode(code);
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
    }
  };

  const handleInputChange = useCallback((value: string) => {
    if (!isAttemptActive) return;

    setUserInput(value);
    const currentWord = battleStart.words[currentIndex];

    if (value === currentWord + " ") {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setUserInput("");

      const timeElapsed = (battleStart.settings.testDuration - (attemptTimer || 0)) / 60;
      const currentWpm = timeElapsed > 0 ? Math.round(newIndex / timeElapsed) : 0;
      
      setWpm(currentWpm);
      sendProgress(Math.min(Math.round((newIndex / 50) * 100), 100), currentWpm);
    }
  }, [isAttemptActive, currentIndex, battleStart, attemptTimer, sendProgress]);

  const handleAdminStart = () => {
    startBattle({
      testDuration,
      totalTime,
      maxAttempts
    });
  };

  const copyCode = () => {
    if (battleCode) {
      navigator.clipboard.writeText(battleCode);
      toast({
        title: t.battle.copied,
        description: t.battle.copiedDesc,
      });
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Users className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">{t.battle.signInTitle}</h2>
        <Button onClick={() => window.location.href = "/auth"}>
          {t.nav.signIn}
        </Button>
      </div>
    );
  }

  if (!battleCode) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-black mb-4 tracking-tighter bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent italic">
            BATTLE ARENA
          </h1>
          <p className="text-muted-foreground text-lg">Tezlikka asoslangan haqiqiy bellashuv!</p>
        </motion.div>
        
        <div className="grid gap-6">
          <Card className="border-2 hover:border-primary/50 transition-colors bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-6 h-6 text-primary" />
                Yangi Jang Yaratish
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">O'z xonangizni yarating va do'stlaringizni taklif qiling.</p>
              <Button onClick={createBattle} disabled={isCreating} className="w-full h-12 text-lg font-bold">
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Xona yaratish"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                Jangga qo'shilish
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input 
                  placeholder="Xona kodini kiriting"
                  value={inputCode} 
                  onChange={(e) => setInputCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinBattle()}
                  className="font-mono uppercase h-12 text-center text-xl tracking-widest"
                />
                <Button onClick={joinBattle} className="h-12 px-8 font-bold">Qo'shilish</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-primary border-primary px-3 py-1 font-mono text-lg">
              {battleCode}
            </Badge>
            {isAdmin && <Badge className="bg-orange-500 hover:bg-orange-600 gap-1"><Crown className="w-3 h-3" /> Admin</Badge>}
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
          </div>
          <p className="text-muted-foreground mt-1">
            {room?.status === 'waiting' ? "O'yinchilar kutilmoqda..." : "Jang qizg'in pallada!"}
          </p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={copyCode} className="gap-2 shrink-0">
            <Copy className="w-4 h-4" /> Kod
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()} className="text-red-500 hover:text-red-600 hover:bg-red-50/10">
            Chiqish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Game Area / Settings */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {room?.status === 'waiting' && (
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {isAdmin ? "Jang Sozlamalari" : "Kutilmoqda"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {isAdmin ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <Label>Test davomiyligi: {testDuration} soniya</Label>
                      </div>
                      <Slider value={[testDuration]} onValueChange={([v]) => setTestDuration(v)} min={15} max={60} step={5} />
                      
                      <div className="flex justify-between">
                        <Label>Umumiy vaqt: {totalTime} daqiqa</Label>
                      </div>
                      <Slider value={[totalTime]} onValueChange={([v]) => setTotalTime(v)} min={1} max={10} step={1} />
                    </div>
                    
                    <Button 
                      onClick={handleAdminStart} 
                      className="w-full h-14 text-xl font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                      disabled={!isConnected}
                    >
                      <Play className="w-6 h-6 mr-2" /> JANGNI BOSHLASH
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center py-12 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                    <h3 className="text-xl font-bold">Admin jangni boshlashini kuting</h3>
                    <p className="text-muted-foreground">O'yinchilar: {room?.players?.length || 0}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {battleStart && !battleEnd && (
            <div className="space-y-6">
              {/* Timers & Status */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-primary/10 border-primary/20 p-4 border-2 flex flex-col items-center justify-center">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Umumiy vaqt</span>
                  <span className="text-4xl font-black font-mono flex items-center gap-2">
                    <Timer className="w-6 h-6 text-primary" />
                    {totalTimer !== null ? `${Math.floor(totalTimer / 60)}:${(totalTimer % 60).toString().padStart(2, '0')}` : "--:--"}
                  </span>
                </Card>
                <Card className={`p-4 border-2 flex flex-col items-center justify-center transition-colors ${isAttemptActive ? "bg-orange-500/10 border-orange-500/40" : "bg-card border-dashed"}`}>
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Sizning Urinishingiz</span>
                  <span className={`text-4xl font-black font-mono focus-ring ${isAttemptActive ? "text-orange-500" : "text-muted-foreground"}`}>
                    {attemptTimer !== null ? `${attemptTimer}s` : "0s"}
                  </span>
                </Card>
              </div>

              {/* Typing Area */}
              <div className="relative">
                {!isAttemptActive ? (
                  <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] rounded-xl flex items-center justify-center flex-col gap-4 border-2 border-dashed border-primary/40 p-8 text-center">
                    <Flame className="w-12 h-12 text-orange-500 animate-bounce" />
                    <div>
                      <h3 className="text-2xl font-bold">Tayyormisiz?</h3>
                      <p className="text-muted-foreground">Har bir urinish {battleStart.settings.testDuration} soniya davom etadi.</p>
                    </div>
                    <Button onClick={startAttempt} size="lg" className="h-14 px-12 text-xl font-black rounded-full shadow-xl" disabled={totalTimer === 0}>
                      URINISHNI BOSHLASH
                    </Button>
                  </div>
                ) : null}

                <div className={`${!isAttemptActive ? "blur-sm opacity-30 select-none grayscale" : "animate-in fade-in duration-700"}`}>
                  <div className="flex justify-center gap-12 mb-8">
                    <div className="text-center">
                      <div className="text-5xl font-black font-mono text-primary">{wpm}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Soniya / WPM</div>
                    </div>
                  </div>

                  <TypingArea
                    words={battleStart.words}
                    userInput={userInput}
                    onInputChange={handleInputChange}
                    onComplete={() => {}}
                    isActive={isAttemptActive}
                    currentIndex={currentIndex}
                  />
                </div>
              </div>
            </div>
          )}

          {battleEnd && (
            <Card className="border-4 border-primary shadow-2xl overflow-hidden">
              <div className="bg-primary p-8 text-white text-center">
                <Trophy className="w-20 h-20 mx-auto mb-4 animate-bounce" />
                <h2 className="text-4xl font-black tracking-tighter uppercase italic">
                  Jang Yakunlandi!
                </h2>
                <p className="text-primary-foreground/80 mt-2 text-lg">G'oliblar aniqlandi</p>
              </div>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  {battleEnd.results.map((player: any, index: number) => (
                    <motion.div 
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 ${index === 0 ? "border-yellow-500 bg-yellow-500/10" : "bg-muted/50 border-transparent"}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? "bg-yellow-500 text-white" : "bg-muted text-muted-foreground"}`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-lg">{player.username}</p>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest">{player.attempts}ta urinish</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-black font-mono text-primary">{player.bestWpm}</span>
                        <span className="text-sm text-muted-foreground ml-1">WPM</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <Button onClick={() => window.location.reload()} className="w-full h-12 text-lg font-bold" variant="outline">
                  <RotateCcw className="w-5 h-5 mr-2" /> Qayta O'ynash
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Leaderboard / Players List */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="border-2 h-fit">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center justify-between">
                <span>Leaderboard</span>
                <Users className="w-4 h-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {room?.players?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground italic">Ishtirokchilar yo'q...</div>
                ) : (
                  room?.players?.map((player: any, idx: number) => {
                    const isLeading = player.id === leadingPlayerId;
                    return (
                      <motion.div 
                        key={player.id} 
                        layout 
                        className={`relative p-3 rounded-lg border-2 transition-colors ${isLeading ? "border-orange-500/50 bg-orange-500/5" : "border-transparent"}`}
                      >
                        {isLeading && (
                          <div className="absolute -top-3 -right-2 bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                            <Flame className="w-3 h-3" /> PESHQADAM
                          </div>
                        )}
                        <BattleProgressBar
                          username={player.username}
                          avatarUrl={player.avatarUrl}
                          progress={player.progress}
                          wpm={player.bestWpm > player.wpm ? player.bestWpm : player.wpm}
                          isMe={player.id === user.id}
                          youLabel="Siz"
                        />
                        <div className="flex justify-between items-center -mt-4 px-1">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{player.attempts} Urinish</span>
                          <span className="text-xs font-black text-primary/60">{player.bestWpm} Peak WPM</span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="border-2 bg-muted/20 border-dashed border-muted-foreground/30">
            <CardContent className="pt-6">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Play className="w-4 h-4" /> QOIDA
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Jang davomida xohlagancha urinish qiling.</li>
                <li>Faqat eng yuqori natijangiz hisobga olinadi.</li>
                <li>Har bir urinish {room?.settings?.testDuration || 30}s davom etadi.</li>
                <li>Vaqt tugaguniga qadar natijani yaxshilang!</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Countdown Overlay */}
      <AnimatePresence>
        {countdown !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 backdrop-blur-xl z-[100] flex items-center justify-center"
          >
            <motion.div 
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-center"
            >
              <div className="text-[15rem] font-black italic tracking-tighter leading-none text-primary">
                {countdown}
              </div>
              <p className="text-2xl font-black uppercase tracking-[0.5em] mt-4">Tayyorlaning!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
