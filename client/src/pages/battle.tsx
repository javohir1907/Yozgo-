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
  const [attemptCount, setAttemptCount] = useState<number>(0);

  const correctCharsRef = useRef(0);
  const allKeystrokesRef = useRef(0);
  
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

  // LOKAL TARJIMALAR (3 tilda)
  const uiTexts = {
    uz: {
      genderLabel: "Auditoriya jinsi",
      genderAll: "🚻 Aralash (Barchasi)",
      genderMale: "🙋♂️ Faqat o'g'il bolalar",
      genderFemale: "🙋♀️ Faqat qiz bolalar",
      participantsLabel: "Ishtirokchilar soni (Narxlar)",
      free: "Bepul",
      negotiable: "Kelishiladi",
      tier10: "10 tagacha",
      tier20: "11-20 ta",
      tier50: "21-50 ta",
      tier100: "51-100 ta",
      tierVIP: "101+ (VIP)",
      winModeLabel: "Musobaqa usuli",
      winModeOverall: "🏆 Umumiy davr (1 ta g'olib)",
      winModePerRound: "🎯 Har bir davr (Alohida g'oliblar)"
    },
    ru: {
      genderLabel: "Пол аудитории",
      genderAll: "🚻 Смешанный (Все)",
      genderMale: "🙋♂️ Только парни",
      genderFemale: "🙋♀️ Только девушки",
      participantsLabel: "Кол-во участников (Цены)",
      free: "Бесплатно",
      negotiable: "Договорная",
      tier10: "До 10",
      tier20: "11-20 чел",
      tier50: "21-50 чел",
      tier100: "51-100 чел",
      tierVIP: "101+ (VIP)",
      winModeLabel: "Формат турнира",
      winModeOverall: "🏆 Общее время (1 победитель)",
      winModePerRound: "🎯 По раундам (Победитель в каждом)"
    },
    en: {
      genderLabel: "Audience Gender",
      genderAll: "🚻 Mixed (Everyone)",
      genderMale: "🙋♂️ Boys only",
      genderFemale: "🙋♀️ Girls only",
      participantsLabel: "Participants limit (Pricing)",
      free: "Free",
      negotiable: "Negotiable",
      tier10: "Up to 10",
      tier20: "11-20 users",
      tier50: "21-50 users",
      tier100: "51-100 users",
      tierVIP: "101+ (VIP)",
      winModeLabel: "Tournament Mode",
      winModeOverall: "🏆 Overall duration (1 winner)",
      winModePerRound: "🎯 Per round (Individual winners)"
    }
  };

  // Tizimdagi hozirgi tilni aniqlash (Default: 'uz')
  const currentLang = localStorage.getItem('yozgo_lang') || 'uz';
  const loc = (uiTexts as any)[currentLang] || uiTexts.uz;

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
        const currentAcc = allKeystrokesRef.current > 0 
            ? Math.round((correctCharsRef.current / allKeystrokesRef.current) * 100) 
            : 100;
        
        setWpm(currentWpm);
        setAccuracy(currentAcc);

        const prog = currentWords.length > 0 ? Math.min(100, Math.round((currentIndex / currentWords.length) * 100)) : 0;
        sendProgress(prog, currentWpm);
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
    setAttemptCount(prev => prev + 1);
  };

  /**
   * Urinishni yakunlash va natijani serverga yuborish.
   */
  const finalizeAttempt = () => {
    setIsAttemptActive(false);
    setAttemptTimer(null);
    if (wpm > 0) {
      submitResult(wpm, accuracy, 100);
      toast({ title: t.battle.readyStatus, description: `${wpm} WPM ${t.battle.resultSaved}` });
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
      const array = new Uint8Array(3);
      window.crypto.getRandomValues(array);
      const code = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
      
      await apiRequest("POST", "/api/battles", {
        code,
        status: "waiting",
        language,
        mode: testDuration.toString(),
        maxParticipants: participantTier,
        genderRestriction: genderRestriction,
      });
      setBattleCode(code);
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
                  <Label>{loc.genderLabel}</Label>
                  <select 
                    value={genderRestriction} 
                    onChange={e => setGenderRestriction(e.target.value as any)} 
                    className="w-full bg-background border p-3 rounded-xl font-medium focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                  >
                    <option value="all">{loc.genderAll}</option>
                    <option value="male">{loc.genderMale}</option>
                    <option value="female">{loc.genderFemale}</option>
                  </select>
                </div>

                {/* 3. Musobaqa Usuli */}
                <div className="space-y-1 md:col-span-2">
                  <Label>{loc.winModeLabel}</Label>
                  <select 
                    value={winMode} 
                    onChange={e => setWinMode(e.target.value as "overall" | "per_round")} 
                    className="w-full bg-background border p-3 rounded-xl font-medium focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                  >
                    <option value="overall">{loc.winModeOverall}</option>
                    <option value="per_round">{loc.winModePerRound}</option>
                  </select>
                </div>

                {/* 4. Ishtirokchilar soni (Chiroyli Tugmalar) */}
                <div className="space-y-2 md:col-span-2 mt-2">
                  <Label className="flex items-center gap-2">
                    {loc.participantsLabel}
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { val: 10, label: loc.tier10, price: loc.free, icon: "🚀", color: "text-green-500" },
                      { val: 20, label: loc.tier20, price: "29 000 so'm", icon: "🔥", color: "text-orange-500" },
                      { val: 50, label: loc.tier50, price: "59 000 so'm", icon: "⚡", color: "text-yellow-500" },
                      { val: 100, label: loc.tier100, price: "109 000 so'm", icon: "👑", color: "text-purple-500" },
                      { val: 999, label: loc.tierVIP, price: loc.negotiable, icon: "💎", color: "text-blue-500" },
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
                {TERMS_LIST.map((term, i) => <li key={i}>{term}</li>)}
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
      <SEO title={`Jang: ${battleCode} | YOZGO`} />
      
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
                  <div className="w-full max-w-md mb-8">
                    <p className="text-muted-foreground text-center mb-4">Har bir davr g'oliblarlari:</p>
                    <div className="space-y-2">
                      {battleEnd.roundWinners.map((w: any) => (
                        <div key={w.round} className="flex justify-between items-center bg-background/50 p-3 rounded-lg border border-primary/20">
                          <span className="font-bold text-muted-foreground">{w.round}-Davr:</span>
                          <span className="font-black text-lg flex items-center gap-2">
                            {w.username} <Badge variant="secondary">{w.wpm} WPM</Badge>
                          </span>
                        </div>
                      ))}
                      {battleEnd.roundWinners.length === 0 && (
                        <p className="text-center text-sm text-red-500">Hech kim raundni to'liq yakunlamadi.</p>
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
                     <div className="flex justify-center gap-8 sm:gap-20 mb-6 sm:mb-10">
                        <div className="text-center">
                          <div className="text-5xl sm:text-6xl font-black text-primary leading-none">{wpm}</div>
                          <div className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-2">WPM (TEZLIK)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-5xl sm:text-6xl font-black text-primary leading-none">{accuracy}%</div>
                          <div className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-2">ANIQLIK</div>
                        </div>
                     </div>
                     <TypingArea 
                        words={currentWords} 
                        isActive={isAttemptActive} 
                        onInputChange={handleInputChange} 
                        userInput={userInput}
                        currentIndex={currentIndex}
                        history={history}
                        onComplete={finalizeAttempt}
                        onGoBack={handleGoBack} 
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
              <CardTitle className="text-xl flex items-center gap-2"><Trophy className="text-yellow-500" /> {t.battle.live}</CardTitle>
              <Badge variant="outline">{room?.players.length || 0} {t.battle.players.toLowerCase()}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {room?.players.map((p: any, i: number) => (
                <div key={p.id} className={`relative overflow-hidden flex items-center justify-between p-3 rounded-xl border border-transparent transition-all ${p.isDisconnected ? "bg-secondary/20 opacity-50 grayscale" : "bg-secondary/40 hover:border-border"}`}>
                  {/* Live Progress Bar Background */}
                  <div className="absolute top-0 left-0 bottom-0 bg-primary/10 transition-all duration-300" style={{ width: `${p.progress}%` }} />
                  
                  <div className="relative z-10 flex items-center gap-3">
                    <span className="text-sm font-black opacity-20 w-4">{i + 1}</span>
                    <div className="relative">
                      {p.id === room?.adminId && <Crown className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500 fill-current" />}
                      <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-white/10" />
                    </div>
                    <span className="font-bold text-sm truncate max-w-[100px]">{p.username} {p.isDisconnected ? `(${t.battle.disconnected})` : ""}</span>
                  </div>
                  <div className="relative z-10 text-right">
                    <div className="font-black text-primary">{p.wpm > 0 ? p.wpm : p.bestWpm} WPM</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground opacity-50">{p.attempts} {t.battle.attempts} ({t.battle.best}: {p.bestWpm})</div>
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
