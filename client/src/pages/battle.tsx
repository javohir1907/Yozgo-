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
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Crown, Play, Copy, Users, Clock, Timer, 
  Flame, Trophy, Check, Loader2, Maximize2, 
  BarChart3, Zap, Target, Activity, ShieldAlert
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
  DialogTrigger,
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

// Rules are now moved to i18n


// ============ MAIN COMPONENT ============


function PlayerListItem({ p, i, room, t }: { p: any; i: number; room: any; t: any }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Dialog open={showDetails} onOpenChange={setShowDetails}>
      <DialogTrigger asChild>
        <button className={`w-full relative overflow-hidden flex items-center justify-between p-3 rounded-xl border border-transparent transition-all group ${p.isDisconnected ? "bg-secondary/20 opacity-50 grayscale" : "bg-secondary/40 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98]"}`}>
          {/* Live Progress Bar Background */}
          <div className="absolute top-0 left-0 bottom-0 bg-primary/10 transition-all duration-300" style={{ width: `${p.progress}%` }} />
          
          <div className="relative z-10 flex items-center gap-3">
            <span className="text-sm font-black opacity-20 w-4">{i + 1}</span>
            <div className="relative">
              {p.id === room?.adminId && <Crown className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500 fill-current" />}
              <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-white/10 flex items-center justify-center overflow-hidden">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-4 h-4 opacity-40" />
                )}
              </div>
            </div>
            <span className="font-bold text-sm truncate max-w-[100px]">{p.username} {p.isDisconnected ? `(${t.battle.disconnected})` : ""}</span>
          </div>
          <div className="relative z-10 text-right flex items-center gap-2">
            <div>
              <div className="font-black text-primary leading-none">{p.bestWpm || 0} WPM</div>
              <div className="text-[10px] font-bold text-muted-foreground/50">{t.battle.best}</div>
            </div>
            <Maximize2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl rounded-3xl border-2">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full object-cover rounded-3xl"/> : <Users className="w-8 h-8 opacity-40" />}
             </div>
             <div>
                <DialogTitle className="text-2xl font-black">{p.username}</DialogTitle>
                <div className="flex gap-2 mt-1">
                   <Badge variant="secondary" className="bg-primary/5 text-primary">ID: {p.id.slice(0, 8)}</Badge>
                   {p.gender === "male" ? <Badge className="bg-blue-500/10 text-blue-500">MALE</Badge> : <Badge className="bg-pink-500/10 text-pink-500">FEMALE</Badge>}
                </div>
             </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
           <div className="p-4 rounded-2xl bg-secondary/50 border border-border/50 text-center">
              <Zap className="w-5 h-5 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-black">{p.bestWpm || 0}</div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground">BEST WPM</div>
           </div>
           <div className="p-4 rounded-2xl bg-secondary/50 border border-border/50 text-center">
              <Target className="w-5 h-5 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-black">{p.bestAccuracy || 0}%</div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground">ACCURACY</div>
           </div>
           <div className="p-4 rounded-2xl bg-secondary/50 border border-border/50 text-center">
              <Activity className="w-5 h-5 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-black">{p.bestConsistency || 0}%</div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground">CONSISTENCY</div>
           </div>
           <div className="p-4 rounded-2xl bg-secondary/50 border border-border/50 text-center">
              <BarChart3 className="w-5 h-5 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-black">{p.bestRawWpm || 0}</div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground">RAW WPM</div>
           </div>
        </div>

        <div className="space-y-4">
           <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Batafsil Urinishlar Natijasi</h4>
           <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {p.attemptHistory && p.attemptHistory.length > 0 ? (
                p.attemptHistory.map((h: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/20">
                     <span className="font-bold text-sm text-muted-foreground">{idx+1}-Urinish:</span>
                     <div className="flex gap-3">
                        <span className="font-black text-primary">{h.wpm} WPM</span>
                        <span className="text-xs font-bold text-muted-foreground/60">{h.accuracy}% ACC</span>
                        <span className="text-xs font-bold text-muted-foreground/60">{h.consistency || 0}% CNS</span>
                     </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm italic">Hali urinishlar mavjud emas</div>
              )}
           </div>
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between items-center">
           <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {p.attempts || 0} ta urinish qildi
           </div>
           {p.bestWpm > 200 && (
             <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase animate-pulse">
                <ShieldAlert className="w-3 h-3" /> Yuqori tezlik ko'rsatkichi
             </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [attemptCount, setAttemptCount] = useState<number>(0);

  const correctCharsRef = useRef(0);
  const allKeystrokesRef = useRef(0);
  const keystrokeIntervalsRef = useRef<number[]>([]);
  const lastKeystrokeTimeRef = useRef<number | null>(null);

  const [rawWpm, setRawWpm] = useState<number>(0);
  const [consistency, setConsistency] = useState<number>(100);
  
  // --- STATE: Settings & Terms ---
  const [testDuration, setTestDuration] = useState<number>(GAME_DEFAULTS.TEST_DURATION);
  const [totalTime, setTotalTime] = useState<number>(GAME_DEFAULTS.TOTAL_TIME);
  const [language, setLanguage] = useState<string>(GAME_DEFAULTS.LANGUAGE);
  const [adminParticipates, setAdminParticipates] = useState<boolean>(true);
  const [winMode, setWinMode] = useState<"overall" | "per_round">("overall");
  
  // YANGI QO'SHILGANLAR:
  const [participantTier, setParticipantTier] = useState<number>(10); // 10, 20, 50, 100, 999
  const [genderRestriction, setGenderRestriction] = useState<"all" | "male" | "female">("all");
  const [showTerms, setShowTerms] = useState<boolean>(false);
  const [isAgreed, setIsAgreed] = useState<boolean>(false);

  // Tizimdagi hozirgi tilni aniqlash (Default: 'uz')
  // const currentLang = localStorage.getItem('yozgo_lang') || 'uz';
  // const loc = (uiTexts as any)[currentLang] || uiTexts.uz;

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

  // Focus Detection
  useEffect(() => {
    const handleBlur = () => {
      if (isAttemptActive && battleCode) {
        // Option: Send a message to server that user lost focus
        // For now, we just slow down or mark
      }
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [isAttemptActive, battleCode]);

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
   * Urinish (Attempt) taymerini va Jonli statistika (Live Stats) boshqarish.
   */
  const currentWords = useMemo(() => {
    // We have 3000 words from backend. We slice 300 words for each attempt.
    // If they do more than 10 attempts, it wraps around seamlessly.
    const startIdx = (attemptCount * 300) % (battleStart?.words?.length || 1);
    return battleStart?.words?.slice(startIdx, startIdx + 300) || [];
  }, [battleStart?.words, attemptCount]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAttemptActive && attemptTimer !== null && attemptTimer > 0) {
      interval = setTimeout(() => setAttemptTimer(prev => (prev !== null ? prev - 1 : 0)), 1000);
    } else if (isAttemptActive && attemptTimer === 0) {
      finalizeAttempt();
    }
    return () => clearTimeout(interval);
  }, [isAttemptActive, attemptTimer]);

  useEffect(() => {
    let statsInterval: NodeJS.Timeout;

    const updateLiveStats = () => {
      if (!attemptStartTime) return;
      const elapsedMins = (Date.now() - attemptStartTime) / 60000;
      if (elapsedMins > 0) {
        const currentWpm = Math.max(0, Math.round((correctCharsRef.current / 5) / elapsedMins));
        const currentRawWpm = Math.max(0, Math.round((allKeystrokesRef.current / 5) / elapsedMins));
        const currentAcc = allKeystrokesRef.current > 0 
            ? Math.round((correctCharsRef.current / allKeystrokesRef.current) * 100) 
            : 100;
        
        // Consistency calculation
        const intervals = keystrokeIntervalsRef.current;
        let currentConsistency = 100;
        if (intervals.length >= 2) {
          const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
          const stdDev = Math.sqrt(variance);
          const cv = stdDev / mean;
          currentConsistency = Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
        }

        setWpm(currentWpm);
        setRawWpm(currentRawWpm);
        setAccuracy(currentAcc);
        setConsistency(currentConsistency);

        const prog = currentWords.length > 0 ? Math.min(100, Math.round((currentIndex / currentWords.length) * 100)) : 0;
        sendProgress(prog, currentWpm, { rawWpm: currentRawWpm, consistency: currentConsistency, accuracy: currentAcc });
      }
    };

    if (isAttemptActive && attemptStartTime) {
      statsInterval = setInterval(updateLiveStats, 200);
    }
    return () => clearInterval(statsInterval);
  }, [isAttemptActive, attemptStartTime, currentIndex, currentWords.length, sendProgress]);

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
    correctCharsRef.current = 0;
    allKeystrokesRef.current = 0;
    keystrokeIntervalsRef.current = [];
    lastKeystrokeTimeRef.current = null;
    setRawWpm(0);
    setConsistency(100);
    setAttemptCount(prev => prev + 1);
  };

  /**
   * Urinishni yakunlash va natijani serverga yuborish.
   */
  const finalizeAttempt = () => {
    setIsAttemptActive(false);
    setAttemptTimer(null);
    if (wpm > 0) {
      submitResult(wpm, accuracy, 100, { rawWpm, consistency });
      toast({ title: t.battle.readyStatus, description: `${wpm} WPM | ${accuracy}% ACC | ${consistency}% CNS` });
    }
  };

  /**
   * Klaviaturadan kelayotgan yozuvlarni qabul qilish va progressni hisoblash
   */
  const handleInputChange = useCallback(
    (value: string) => {
      if (!isAttemptActive || !battleStart) return;

      const word = currentWords[currentIndex];
      if (!word) return;

      if (value.endsWith(" ") || value.endsWith("\u00A0")) {
        const currentTyped = value.slice(0, -1);
        
        if (currentTyped.length > userInput.length) {
          allKeystrokesRef.current += (currentTyped.length - userInput.length);
          for (let i = userInput.length; i < currentTyped.length; i++) {
            if (currentTyped[i] === word[i]) correctCharsRef.current++;
          }
        } else if (currentTyped.length < userInput.length) {
          for (let i = currentTyped.length; i < userInput.length; i++) {
            if (userInput[i] === word[i]) correctCharsRef.current--;
          }
        }
        
        allKeystrokesRef.current += 1; 
        if (currentTyped === word) correctCharsRef.current += 1; 

        setHistory((prev) => [...prev, currentTyped]);
        setCurrentIndex((prev) => prev + 1);
        setUserInput("");
      } else {
        if (value.length > userInput.length) {
          allKeystrokesRef.current += (value.length - userInput.length);
          for (let i = userInput.length; i < value.length; i++) {
            if (value[i] === word[i]) correctCharsRef.current++;
          }
        } else if (value.length < userInput.length) {
          for (let i = value.length; i < userInput.length; i++) {
            if (userInput[i] === word[i]) correctCharsRef.current--;
          }
        }
        setUserInput(value);
      }

      // Track intervals for consistency
      const now = Date.now();
      if (lastKeystrokeTimeRef.current) {
        const interval = now - lastKeystrokeTimeRef.current;
        if (interval < 2000) { // Filter out long pauses (e.g. over 2s)
          keystrokeIntervalsRef.current.push(interval);
        }
      }
      lastKeystrokeTimeRef.current = now;
    },
    [isAttemptActive, battleStart, currentIndex, history, userInput, currentWords]
  );

  const handleGoBack = useCallback(() => {
    if (currentIndex > 0 && userInput.length === 0) {
      const prevWordIdx = currentIndex - 1;
      const prevWordTarget = currentWords[prevWordIdx];
      const prevInput = history[prevWordIdx];

      if (prevInput === prevWordTarget) return; 

      setHistory((prev) => prev.slice(0, -1));
      setCurrentIndex(prevWordIdx);
      setUserInput(prevInput);
      
      allKeystrokesRef.current = Math.max(0, allKeystrokesRef.current - 1);
    }
  }, [currentIndex, userInput, history, currentWords]);

  /**
   * Jang xonasini yaratish.
   */
  const handleCreateBattle = async () => {
    setIsCreating(true);
    try {
      const response = await apiRequest("POST", "/api/battles", {
        language,
        mode: testDuration.toString(),
        maxParticipants: participantTier,
        genderRestriction: genderRestriction,
        accessCode: inputCode.trim().toUpperCase(), // Pullik kod bo'lsa yuborish
      });
      const data = await response.json();
      setBattleCode(data.code);
    } catch (err: any) {
      toast({ title: t.battle.error, description: err.message || t.battle.failedCreate, variant: "destructive" });
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
      toast({ title: t.battle.error, description: err.message, variant: "destructive" });
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
      toast({ title: t.battle.error, description: err.message, variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  // ============ RENDER LOGIC ============

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Users className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">{t.battle.loginToJoin}</h2>
        <Button onClick={() => setLocation("/auth")}>{t.auth.login}</Button>
      </div>
    );
  }

  // Pre-join state
  if (!battleCode) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <SEO title={`${t.battle.arena} | YOZGO`} description={t.battle.arenaSubtitle} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-12">
          <h1 className="text-6xl font-black mb-2 tracking-tighter bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent transform -skew-x-6">
            {t.battle.arena}
          </h1>
          <p className="text-muted-foreground">{t.battle.arenaSubtitle}</p>
        </motion.div>

        <div className="grid gap-6">
          {/* Create Room */}
          <Card className="border-2 hover:border-primary/40 transition-all bg-card/60 backdrop-blur-md">
            <CardHeader><CardTitle className="flex items-center gap-2"><Play className="text-primary" /> {t.battle.newBattle}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Rol va Til (Yonma-yon) */}
                <div className="space-y-1">
                  <Label>{t.battle.role}</Label>
                  <select value={adminParticipates ? "true" : "false"} onChange={e => setAdminParticipates(e.target.value === "true")} className="w-full bg-background border p-3 rounded-xl focus:ring-2 focus:ring-primary/50 transition-all outline-none">
                    <option value="true">{t.battle.participant}</option>
                    <option value="false">{t.battle.spectator}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>{t.battle.language}</Label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-background border p-3 rounded-xl focus:ring-2 focus:ring-primary/50 transition-all outline-none">
                    <option value="uz">{t.languages.uzbek}</option>
                    <option value="en">{t.languages.english}</option>
                    <option value="ru">{t.languages.russian}</option>
                  </select>
                </div>

                {/* 2. Jins Cheklovi */}
                <div className="space-y-1 md:col-span-2">
                  <Label>{t.battle.genderLabel}</Label>
                  <select 
                    value={genderRestriction} 
                    onChange={e => setGenderRestriction(e.target.value as any)} 
                    className="w-full bg-background border p-3 rounded-xl font-medium focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                  >
                    <option value="all">{t.battle.genderAll}</option>
                    <option value="male">{t.battle.genderMale}</option>
                    <option value="female">{t.battle.genderFemale}</option>
                  </select>
                </div>

                {/* 3. Musobaqa Usuli */}
                <div className="space-y-1 md:col-span-2">
                  <Label>{t.battle.winModeLabel}</Label>
                  <select 
                    value={winMode} 
                    onChange={e => setWinMode(e.target.value as "overall" | "per_round")} 
                    className="w-full bg-background border p-3 rounded-xl font-medium focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                  >
                    <option value="overall">{t.battle.winModeOverall}</option>
                    <option value="per_round">{t.battle.winModePerRound}</option>
                  </select>
                </div>

                {/* 4. Ishtirokchilar soni (Chiroyli Tugmalar) */}
                <div className="space-y-2 md:col-span-2 mt-2">
                  <Label className="flex items-center gap-2">
                    {t.battle.participantsLabel}
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { val: 10, label: t.battle.tier10, price: t.battle.free, icon: "🚀", color: "text-green-500" },
                      { val: 20, label: t.battle.tier20, price: t.battle.tier20Price, icon: "🔥", color: "text-orange-500" },
                      { val: 50, label: t.battle.tier50, price: t.battle.tier50Price, icon: "⚡", color: "text-yellow-500" },
                      { val: 100, label: t.battle.tier100, price: t.battle.tier100Price, icon: "👑", color: "text-purple-500" },
                      { val: 999, label: t.battle.tierVIP, price: t.battle.negotiable, icon: "💎", color: "text-blue-500" },
                    ].map(tier => (
                      <button
                        key={tier.val}
                        onClick={() => setParticipantTier(tier.val)}
                        type="button"
                        className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 ${
                          participantTier === tier.val 
                            ? 'border-primary bg-primary/10 scale-[1.02] shadow-md' 
                            : 'border-border bg-card/50 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                      >
                        <span className={`text-2xl mb-1 drop-shadow-md ${tier.color}`}>{tier.icon}</span>
                        <span className="font-bold text-sm text-center">{tier.label}</span>
                        <span className="text-xs font-semibold text-muted-foreground mt-0.5 px-2 py-0.5 rounded-full bg-background border">
                          {tier.price}
                        </span>
                        
                        {/* Active Indicator Checkmark */}
                        {participantTier === tier.val && (
                          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Pullik xona uchun kod kiritish */}
                {participantTier > 10 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 md:col-span-2 mt-4 p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/30"
                  >
                    <Label className="text-primary font-bold flex items-center gap-2">
                       🎟️ {t.battle.enterPaidCode}
                    </Label>
                    <Input 
                      placeholder={t.battle.paidCodePlaceholder} 
                      value={inputCode} 
                      onChange={e => setInputCode(e.target.value.toUpperCase())}
                      className="bg-background font-mono text-center text-lg h-12"
                    />
                    <p className="text-[10px] text-muted-foreground text-center">
                      {t.battle.paidCodeHint}
                    </p>
                  </motion.div>
                )}

              </div>
              
              {/* CREATE BUTTON */}
              <Button 
                onClick={handleCreateBattle} 
                disabled={isCreating} 
                size="lg"
                className="w-full font-black h-14 text-lg rounded-xl shadow-lg mt-4"
              >
                {isCreating ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current w-5 h-5" />} 
                {t.battle.openRoom}
              </Button>
            </CardContent>
          </Card>

          {/* Join Room */}
          <Card className="border-2 hover:border-primary/40 transition-all bg-card/60 backdrop-blur-md">
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="text-primary" /> {t.battle.joinBattle}</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input placeholder={t.battle.enterCode} value={inputCode} onChange={e => setInputCode(e.target.value)} className="text-center font-mono uppercase" />
              <Button onClick={handleJoinBattle} disabled={isJoining} className="font-bold">{t.battle.joinBtn}</Button>
            </CardContent>
          </Card>
        </div>

        {/* Terms Dialog */}
        <Dialog open={showTerms} onOpenChange={setShowTerms}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.battle.rulesTitle}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
                {t.battle.rules.map((term, i) => <li key={i}>{term}</li>)}
                <li className="text-red-500 font-bold">🚫 VPN, Proxy yoki har qanday botdan foydalanish taqiqlanadi!</li>
                <li className="text-red-500 font-bold">🚫 Cheat ishlatgan foydalanuvchi butunlay bloklanadi!</li>
              </ul>
              <div className="flex items-center space-x-2 pt-4 border-t">
                <Checkbox id="accept" checked={isAgreed} onCheckedChange={(c) => setIsAgreed(c as boolean)} />
                <Label htmlFor="accept">{t.battle.acceptRules}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleConfirmJoin} disabled={!isAgreed || isJoining}>
                {isJoining ? <Loader2 className="animate-spin mr-2" /> : null} {t.battle.confirmBattle}
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
      <SEO title={`${t.nav.battle}: ${battleCode} | YOZGO`} />
      
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-10 bg-secondary/50 p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <Badge className="text-xl font-mono px-4 py-1.5">{battleCode}</Badge>
          {isAdmin && <Badge variant="secondary" className="gap-1 animate-pulse"><Crown className="w-3" /> Admin</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(battleCode || ""); toast({ title: t.battle.copied }); }}><Copy className="w-4" /></Button>
          <Button variant="ghost" className="text-red-500 hover:bg-red-500/10" onClick={() => setLocation("/")}>{t.battle.leaveRoom}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {battleEnd ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-20 bg-card/60 rounded-3xl border-2 border-primary shadow-2xl">
                <Trophy className="w-24 h-24 text-yellow-500 mb-6 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                <h2 className="text-4xl font-black uppercase mb-4 text-center">{t.battle.battleOver}</h2>
                
                {/* Agar UMUMIY DAVR usuli bo'lsa */}
                {battleEnd.mode === "overall" && (
                  <div className="text-center mb-8">
                    <p className="text-muted-foreground text-lg">{t.battle.winnerDetermined}</p>
                    <p className="font-bold text-3xl text-primary mt-2 flex items-center justify-center gap-2">
                      <Crown className="text-yellow-500 w-8 h-8"/> 
                      {battleEnd.winnerId ? battleEnd.overall.find((r: any) => r.id === battleEnd.winnerId)?.username || t.battle.unknown : t.battle.defeat}
                    </p>
                  </div>
                )}

                {/* Agar HAR BIR DAVR (Per Round) usuli bo'lsa */}
                {battleEnd.mode === "per_round" && (
                  <div className="w-full max-w-2xl mb-8 px-4">
                    <p className="text-muted-foreground text-center mb-4 font-bold uppercase tracking-widest text-xs">{t.battle.roundWinners}:</p>
                    <div className="grid grid-cols-1 gap-3">
                      {battleEnd.roundWinners.map((w: any) => (
                        <div key={w.round} className="flex flex-col sm:flex-row justify-between items-center bg-background/50 p-4 rounded-xl border border-primary/20 gap-4 shadow-sm hover:shadow-md transition-all">
                          <span className="font-extrabold text-muted-foreground bg-secondary/80 px-3 py-1 rounded-full text-xs sm:text-sm">{w.round}-{t.battle.round}</span>
                          <span className="font-black text-lg text-primary truncate max-w-[150px]">{w.username}</span>
                          <div className="flex gap-2">
                             <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{w.wpm} WPM</Badge>
                             <Badge variant="outline" className="opacity-70 text-[10px]">{w.accuracy || 100}% ACC</Badge>
                          </div>
                        </div>
                      ))}
                      {battleEnd.roundWinners.length === 0 && (
                        <p className="text-center text-sm text-red-500">{t.battle.noRoundWinners}</p>
                      )}
                    </div>
                  </div>
                )}

                <Button onClick={() => setLocation("/")} size="lg" className="px-10 rounded-full font-bold">
                  {t.battle.backToHome}
                </Button>
              </motion.div>
            ) : !battleStart ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-20 bg-card/60 rounded-3xl border-2 border-dashed border-primary/20">
                <Users className="w-20 h-20 text-primary/20 mb-6" />
                <h2 className="text-3xl font-black uppercase mb-2">{t.battle.waiting}</h2>
                <p className="text-muted-foreground mb-8">{t.battle.playersCount} {room?.players.length || 0}</p>
                {isAdmin && (
                  <div className="flex flex-col items-center gap-6 w-full max-w-md mb-8 bg-secondary/50 p-6 rounded-2xl border border-border shadow-sm">
                    <div className="w-full space-y-3">
                      <Label className="flex justify-between text-muted-foreground">{t.battle.testTime} (soniya): <span className="font-black text-foreground">{testDuration}s</span></Label>
                      <Slider value={[testDuration]} max={120} min={15} step={15} onValueChange={(v) => setTestDuration(v[0])} />
                    </div>
                    <div className="w-full space-y-3">
                      <Label className="flex justify-between text-muted-foreground">{t.battle.totalDuration} (daqiqa): <span className="font-black text-foreground">{totalTime}m</span></Label>
                      <Slider value={[totalTime]} max={30} min={1} step={1} onValueChange={(v) => setTotalTime(v[0])} />
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <Button onClick={() => startBattle({ testDuration, totalTime, maxAttempts: 5, language, adminParticipates, winMode })} size="lg" className="px-16 font-black h-14 text-xl rounded-full shadow-lg hover:scale-105 transition-transform">
                    {t.battle.startBattleBtn} <Play className="ml-2 fill-current" />
                  </Button>
                )}
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                {/* Visual Stats */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-primary/5 p-6 rounded-3xl border-2 border-primary/10 text-center">
                    <span className="text-sm font-bold opacity-50 block mb-1">{t.battle.timeLeft}</span>
                    <span className="text-4xl font-black font-mono flex justify-center items-center gap-2">
                       <Timer className="text-primary" /> {totalTimer !== null ? `${Math.floor(totalTimer/60)}:${(totalTimer%60).toString().padStart(2, '0')}` : "--:--"}
                    </span>
                  </div>
                  <div className={`p-6 rounded-3xl border transition-all text-center shadow-sm ${isAttemptActive ? "bg-primary/10 border-primary/30" : "bg-secondary/50 border-dashed"}`}>
                    <span className="text-sm font-bold opacity-50 block mb-1">{t.battle.testTime}</span>
                    <span className="text-4xl font-black font-mono text-primary">{attemptTimer}s</span>
                  </div>
                </div>

                {/* Game Instance */}
                <div className="relative">
                  {!isAttemptActive && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-[6px] rounded-3xl border-2 border-dashed">
                      <Button onClick={startAttempt} size="lg" className="font-black text-2xl h-16 px-12 rounded-full shadow-2xl skew-x-[-4deg]">
                        {t.battle.nextAttempt} <Flame className="ml-2" />
                      </Button>
                    </div>
                  )}
                  <div className={!isAttemptActive ? "blur-md pointer-events-none opacity-40" : ""}>
          <div className="flex justify-center gap-4 sm:gap-12 mb-6 sm:mb-10 flex-wrap">
                        <div className="text-center">
                          <div className="text-5xl sm:text-7xl font-light text-primary leading-none transition-all duration-500">{wpm || 0}</div>
                          <div className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-2 uppercase tracking-widest">{t.battle.wpmSpeed}</div>
                        </div>
                     </div>
                     <div className="min-h-[220px]">
                      <TypingArea 
                        words={currentWords} 
                        isActive={isAttemptActive} 
                        onInputChange={handleInputChange} 
                        userInput={userInput}
                        currentIndex={currentIndex}
                        history={history}
                        onRestart={startAttempt}
                        onGoBack={handleGoBack} 
                      />
                     </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Leaderboard */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {room?.settings?.genderRestriction === "all" ? (
            <>
              {/* Qizlar (Chapda -> Birinchi) */}
              <Card className="rounded-3xl border-2 border-pink-500/20 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xl flex items-center gap-2">👩 Qizlar</CardTitle>
                  <Badge variant="outline" className="bg-pink-500/10 text-pink-600 dark:text-pink-400">
                    {room.players.filter((p: any) => p.gender === "female").length} ta
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {room.players.filter((p: any) => p.gender === "female").map((p: any, i: number) => (
                    <PlayerListItem key={p.id} p={p} i={i} room={room} t={t} />
                  ))}
                </CardContent>
              </Card>

              {/* Yigitlar (O'ngda -> Ikkinchi) */}
              <Card className="rounded-3xl border-2 border-blue-500/20 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xl flex items-center gap-2">👨 Yigitlar</CardTitle>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {room.players.filter((p: any) => p.gender === "male").length} ta
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {room.players.filter((p: any) => p.gender === "male").map((p: any, i: number) => (
                    <PlayerListItem key={p.id} p={p} i={i} room={room} t={t} />
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-3xl border-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl flex items-center gap-2"><Trophy className="text-yellow-500" /> {t.battle.live}</CardTitle>
                <Badge variant="outline">{room?.players.length || 0} {t.battle.players.toLowerCase()}</Badge>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {room?.players.map((p: any, i: number) => (
                  <PlayerListItem key={p.id} p={p} i={i} room={room} t={t} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
