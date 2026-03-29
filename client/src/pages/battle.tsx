/**
 * YOZGO - Battle Arena Page
 * 
 * Multiplayer rejimida tez yozish jangi sahifasi. Ishtirokchilar xonaga to'planadi,
 * Admin o'yin parametrlarini sozlaydi va musobaqa boshlanadi.
 * 
 * @author YOZGO Team
 * @version 1.2.0
 */

// ============ IMPORTS ============
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Users, Play, Copy, Loader2, Crown, 
  Timer, Settings, RotateCcw, Flame, Check 
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

// Custom Components & Hooks
import { TypingArea } from "@/components/typing-area";
import { BattleProgressBar } from "@/components/battle-progress-bar";
import { useAuth } from "@/hooks/use-auth";
import { useWebsocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import SEO from "@/components/SEO";

// ============ CONSTANTS ============
const GAME_DEFAULTS = {
  TEST_DURATION: 30,
  TOTAL_TIME: 5,
  MAX_ATTEMPTS: 5,
  LANGUAGE: "uz",
};

const TERMS_LIST = [
  "Texnik nosozlik yuzaga kelsa, sovrinlar berilmaydi.",
  "Firibgarlik (Cheating) aniqlansa, natija bekor qilinadi.",
  "Har bir foydalanuvchi faqat bir marta sovrin olishi mumkin.",
  "VPN orqali kirish qat'iyan taqiqlanadi.",
];

// ============ MAIN COMPONENT ============

export default function BattlePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  // --- STATE: Room & Logic ---
  const [battleCode, setBattleCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  
  // --- STATE: Gameplay ---
  const [userInput, setUserInput] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [wpm, setWpm] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(100);
  const [isAttemptActive, setIsAttemptActive] = useState<boolean>(false);
  const [attemptTimer, setAttemptTimer] = useState<number | null>(null);
  const [totalTimer, setTotalTimer] = useState<number | null>(null);
  const [attemptStartTime, setAttemptStartTime] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  
  // --- STATE: Settings & Terms ---
  const [testDuration, setTestDuration] = useState<number>(GAME_DEFAULTS.TEST_DURATION);
  const [totalTime, setTotalTime] = useState<number>(GAME_DEFAULTS.TOTAL_TIME);
  const [language, setLanguage] = useState<string>(GAME_DEFAULTS.LANGUAGE);
  const [adminParticipates, setAdminParticipates] = useState<boolean>(true);
  const [showTerms, setShowTerms] = useState<boolean>(false);
  const [isAgreed, setIsAgreed] = useState<boolean>(false);

  // --- WEBSOCKET HOOK ---
  const {
    room,
    battleStart,
    battleEnd,
    error,
    isConnected,
    startBattle,
    submitResult,
    sendProgress,
  } = useWebsocket(battleCode, user as any);

  const isAdmin = room?.adminId === user?.id;

  // ============ EFFECTS ============

  /**
   * Xatoliklarni toast orqali xabar berish.
   */
  useEffect(() => {
    if (error) {
      toast({ title: t.battle.error, description: error, variant: "destructive" });
      setBattleCode(null);
    }
  }, [error, toast, t]);

  /**
   * Jang boshlangandagi umumiy taymerni ishga tushirish.
   */
  useEffect(() => {
    if (battleStart) {
      const end = battleStart.endTime;
      const tick = () => {
        const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
        setTotalTimer(remaining);
        if (remaining > 0) requestAnimationFrame(tick);
      };
      tick();
    }
  }, [battleStart]);

  /**
   * Urinish (Attempt) taymerini boshqarish.
   */
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAttemptActive && attemptTimer !== null && attemptTimer > 0) {
      interval = setTimeout(() => setAttemptTimer(prev => (prev !== null ? prev - 1 : 0)), 1000);
    } else if (isAttemptActive && attemptTimer === 0) {
      finalizeAttempt();
    }
    return () => clearTimeout(interval);
  }, [isAttemptActive, attemptTimer]);

  // ============ ACTIONS ============

  /**
   * Yangi urinishni (Round) boshlash.
   */
  const startAttempt = () => {
    if (!battleStart || (totalTimer !== null && totalTimer <= 0)) return;
    
    setIsAttemptActive(true);
    setAttemptTimer(battleStart.settings.testDuration);
    setAttemptStartTime(Date.now());
    setUserInput("");
    setCurrentIndex(0);
    setWpm(0);
    setAccuracy(100);
    setHistory([]);
  };

  /**
   * Urinishni yakunlash va natijani serverga yuborish.
   */
  const finalizeAttempt = () => {
    setIsAttemptActive(false);
    setAttemptTimer(null);
    if (wpm > 0) {
      submitResult(wpm, accuracy, 100);
      toast({ title: "Yakunlandi!", description: `${wpm} WPM natijangiz saqlandi.` });
    }
  };

  /**
   * Jang xonasini yaratish.
   */
  const handleCreateBattle = async () => {
    setIsCreating(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await apiRequest("POST", "/api/battles", {
        code,
        status: "waiting",
        language,
        mode: testDuration.toString(),
      });
      setBattleCode(code);
    } catch (err) {
      toast({ title: t.battle.error, description: t.battle.failedCreate, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Kirish kodini tekshirish.
   */
  const handleJoinBattle = async () => {
    if (!inputCode.trim()) return;
    setIsJoining(true);
    try {
      await apiRequest("POST", "/api/battles/validate-code", { 
        battleCode: inputCode.trim().toUpperCase() 
      });
      setShowTerms(true);
    } catch (err: any) {
      toast({ title: "Xona xatosi", description: err.message, variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  /**
   * Shartlarga rozilik bilan xonaga ulanish.
   */
  const handleConfirmJoin = async () => {
    if (!isAgreed) return;
    setIsJoining(true);
    try {
      const response = await apiRequest("POST", "/api/battles/join", {
        battleCode: inputCode.trim().toUpperCase(),
        agreed: true,
      });
      const data = await response.json();
      setBattleCode(data.roomCode);
      setShowTerms(false);
    } catch (err: any) {
      toast({ title: "Ulanishda xatolik", description: err.message, variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  // ============ RENDER LOGIC ============

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Users className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Xonaga kirish uchun avval tizimga kiring</h2>
        <Button onClick={() => setLocation("/auth")}>Kirish</Button>
      </div>
    );
  }

  // Pre-join state
  if (!battleCode) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <SEO title="Arena | YOZGO" description="Haqiqiy tezlik jangi! YOZGO Arena-da do'stlaringiz bilan bellashing." />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-12">
          <h1 className="text-6xl font-black mb-2 tracking-tighter bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent transform -skew-x-6">
            ARENA
          </h1>
          <p className="text-muted-foreground">O'zbekistondagi eng tezkor jangchilar maydoni</p>
        </motion.div>

        <div className="grid gap-6">
          {/* Create Room */}
          <Card className="border-2 hover:border-primary/40 transition-all bg-card/60 backdrop-blur-md">
            <CardHeader><CardTitle className="flex items-center gap-2"><Play className="text-primary" /> Yangi Jang</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Roli</Label>
                  <select value={adminParticipates ? "true" : "false"} onChange={e => setAdminParticipates(e.target.value === "true")} className="w-full bg-background border p-2 rounded-md">
                    <option value="true">👑 Ishtirokchi</option>
                    <option value="false">👁️ Kuzatuvchi</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Til</Label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-background border p-2 rounded-md">
                    <option value="uz">O'zbekcha</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
              <Button onClick={handleCreateBattle} disabled={isCreating} className="w-full font-bold h-12">
                {isCreating ? <Loader2 className="animate-spin" /> : "XONA OCHISH"}
              </Button>
            </CardContent>
          </Card>

          {/* Join Room */}
          <Card className="border-2 hover:border-primary/40 transition-all bg-card/60 backdrop-blur-md">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="text-primary" /> Qo'shilish</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input placeholder="Kod" value={inputCode} onChange={e => setInputCode(e.target.value)} className="text-center font-mono uppercase" />
              <Button onClick={handleJoinBattle} disabled={isJoining} className="font-bold">KIRISH</Button>
            </CardContent>
          </Card>
        </div>

        {/* Terms Dialog */}
        <Dialog open={showTerms} onOpenChange={setShowTerms}>
          <DialogContent>
            <DialogHeader><DialogTitle>Musobaqa Qoidalari</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
                {TERMS_LIST.map((term, i) => <li key={i}>{term}</li>)}
              </ul>
              <div className="flex items-center space-x-2 pt-4 border-t">
                <Checkbox id="accept" checked={isAgreed} onCheckedChange={(c) => setIsAgreed(c as boolean)} />
                <Label htmlFor="accept">Shartlarga roziman</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleConfirmJoin} disabled={!isAgreed || isJoining}>
                {isJoining ? <Loader2 className="animate-spin mr-2" /> : null} ROZIMAN - JANGGA!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Active Battle Lobby/Arena
  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <SEO title={`Jang: ${battleCode} | YOZGO`} />
      
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-10 bg-black/5 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4">
          <Badge className="text-xl font-mono px-4 py-1.5">{battleCode}</Badge>
          {isAdmin && <Badge variant="secondary" className="gap-1 animate-pulse"><Crown className="w-3" /> Admin</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(battleCode || ""); toast({ title: "Nusxalandi!" }); }}><Copy className="w-4" /></Button>
          <Button variant="ghost" className="text-red-500 hover:bg-red-500/10" onClick={() => setLocation("/")}>Chiqish</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {!battleStart ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20 bg-card/60 rounded-3xl border-2 border-dashed border-primary/20">
                <Users className="w-20 h-20 text-primary/20 mb-6" />
                <h2 className="text-3xl font-black uppercase mb-2">Lobbyda kutilmoqda</h2>
                <p className="text-muted-foreground mb-8">Hozirda {room?.players.length || 0} ishtirokchi yig'ildi</p>
                {isAdmin && (
                  <Button onClick={() => startBattle({ testDuration, totalTime, maxAttempts: 5, language, adminParticipates })} size="lg" className="px-16 font-black h-14 text-xl rounded-full">
                    JANGNI BOSHLASH <Play className="ml-2 fill-current" />
                  </Button>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                {/* Visual Stats */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10 text-center">
                    <span className="text-sm font-bold opacity-50 block mb-1">QOLGAN VAQT</span>
                    <span className="text-4xl font-black font-mono flex justify-center items-center gap-2">
                       <Timer className="text-primary" /> {totalTimer !== null ? `${Math.floor(totalTimer/60)}:${(totalTimer%60).toString().padStart(2, '0')}` : "--:--"}
                    </span>
                  </div>
                  <div className={`p-6 rounded-3xl border-2 transition-all text-center ${isAttemptActive ? "bg-orange-500/10 border-orange-500/30" : "bg-black/5 border-dashed"}`}>
                    <span className="text-sm font-bold opacity-50 block mb-1">TEST VAQTI</span>
                    <span className="text-4xl font-black font-mono text-orange-500">{attemptTimer}s</span>
                  </div>
                </div>

                {/* Game Instance */}
                <div className="relative">
                  {!isAttemptActive && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[6px] rounded-3xl border-2 border-dashed">
                      <Button onClick={startAttempt} size="xl" className="font-black text-2xl h-16 px-12 rounded-full shadow-2xl skew-x-[-4deg]">
                        Keyingi Urinish <Flame className="ml-2" />
                      </Button>
                    </div>
                  )}
                  <div className={!isAttemptActive ? "blur-md pointer-events-none opacity-40" : ""}>
                     <div className="flex justify-center gap-20 mb-10">
                        <div className="text-center">
                          <div className="text-6xl font-black text-primary leading-none">{wpm}</div>
                          <div className="text-xs font-bold text-muted-foreground mt-2">WPM (TEZLIK)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-6xl font-black text-orange-500 leading-none">{accuracy}%</div>
                          <div className="text-xs font-bold text-muted-foreground mt-2">ANIQLIK</div>
                        </div>
                     </div>
                     <TypingArea 
                        words={room?.testWords || []} 
                        isActive={isAttemptActive} 
                        onInputChange={(v) => setUserInput(v)} 
                        userInput={userInput}
                        currentIndex={currentIndex}
                        history={history}
                        onComplete={finalizeAttempt}
                        onGoBack={() => {}} 
                      />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Leaderboard */}
        <div className="lg:col-span-4">
          <Card className="rounded-3xl border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center gap-2"><Trophy className="text-yellow-500" /> LIVE</CardTitle>
              <Badge variant="outline">{room?.players.length || 0} ishtirokchi</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {room?.players.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-black/5 border border-transparent hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black opacity-20 w-4">{i + 1}</span>
                    <div className="relative">
                      {p.id === room.adminId && <Crown className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500 fill-current" />}
                      <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-white/10" />
                    </div>
                    <span className="font-bold text-sm truncate max-w-[100px]">{p.username}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-primary">{p.bestWpm} WPM</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground opacity-50">{p.attempts} urinish</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
