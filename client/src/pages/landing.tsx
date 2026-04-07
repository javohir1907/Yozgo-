/**
 * YOZGO - Landing Page
 * 
 * Platformaning asosiy sahifasi. Brend taqdimoti, xususiyatlar (features),
 * musobaqalar va foydalanuvchi fikrlarini o'z ichiga oladi.
 * 
 * @author YOZGO Team
 * @version 1.2.0
 */

// ============ IMPORTS ============
import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Globe, Users, Trophy, Star, Clock } from "lucide-react";

// Components & UI
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Banner } from "@/components/banner";
import SEO from "@/components/SEO";

// Hooks & Libs
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

// ============ TYPES ============
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface ReviewEntry {
  id: string;
  user: { username: string };
  rating: number;
  comment: string;
}

interface CompetitionEntry {
  id: string;
  title: string;
  reward?: string;
  date: string;
  participantsCount: number;
}

// ============ MAIN COMPONENT ============

export default function LandingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");

  // Data Fetching
  const { data: ads } = useQuery<any[]>({ queryKey: ["/api/advertisements"] });
  const { data: competitions } = useQuery<CompetitionEntry[]>({ queryKey: ["/api/competitions"] });
  const { data: reviews } = useQuery<ReviewEntry[]>({ queryKey: ["/api/reviews"] });

  // Mutations
  const submitReview = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      await apiRequest("POST", "/api/reviews", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      setComment("");
      setRating(5);
    },
  });

  // ============ RENDER HELPERS ============


  return (
    <div className="flex flex-col min-h-screen">
      <SEO
        title="YOZGO | O'zbekiston tez yozish platformasi"
        description="YOZGO - O'zbekistondagi eng yirik tez yozish va musobaqalar platformasi. Musobaqalarda qatnashing va mahoratingizni oshiring."
      />

      {/* Hero Section - Edge-to-Edge Full Spread Style (Mobile Responsive Setup) */}
      <section className="relative min-h-[95vh] flex flex-col items-center justify-center overflow-hidden bg-background">
        
        {/* 1. Background Image Container - Absolute Full Spread */}
        <div className="absolute inset-0 w-full h-full z-0 opacity-80 flex items-center justify-center" data-testid="logo-background-container">
          {/* Light mode: Yirik oq klavishli rasm */}
          <img 
            src="/assets/logo-white-keys.png" 
            alt="YOZGO Background" 
            className="w-full h-full object-contain md:object-cover object-center block dark:hidden p-4 md:p-0" 
            style={{ mixBlendMode: 'multiply' }} 
          />
          
          {/* Dark mode: Yirik qora klavishli rasm - Kontrast oshirilgan ('upscale' effekti) */}
          <img 
            src="/assets/logo-black-keys.png" 
            alt="YOZGO Background" 
            className="w-full h-full object-contain md:object-cover object-center hidden dark:block p-4 md:p-0" 
            style={{ filter: 'brightness(1.15) contrast(1.1)' }} /* Klavishlarni yaqqolroq ko'rsatish uchun kontrast */
          />
        </div>

        {/* 2. Content Container - Split into Top (Title) and Bottom (Subtitle & Buttons) */}
        <div className="container relative z-10 px-4 w-full min-h-[95vh] flex flex-col items-center justify-between pt-16 pb-8 md:pt-32 md:pb-20">
          
          {/* Yuqori qism: Asosiy Sarlavha (Klavishlar tepasida) */}
          <div className="text-center w-full max-w-5xl mx-auto px-4 mt-2 md:mt-4">
            <motion.h2
              className="text-4xl md:text-5xl lg:text-7xl font-sans font-black uppercase text-foreground tracking-tight drop-shadow-xl"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {t.landing.heroTitle}
            </motion.h2>
          </div>

          {/* O'rta bo'shliq (Klavishlarning aniq ko'rinishi uchun) */}
          <div className="flex-1 min-h-[20vh] md:min-h-0" />

          {/* Pastki qism: Subtitle va Tugmalar (Klavishlar tagida) */}
          <div className="text-center w-full max-w-4xl mx-auto flex flex-col items-center bg-background/80 backdrop-blur-lg p-6 md:p-10 rounded-3xl shadow-xl border border-border">
            <motion.div
              className="text-base sm:text-lg md:text-2xl text-foreground font-medium mb-6 md:mb-8 bg-card px-6 py-3 md:px-8 md:py-4 rounded-full shadow-sm border border-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {t.landing.heroSubtitle}
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center w-full sm:w-auto px-2 md:px-4 relative z-10">
              <Link href="/typing-test" className="w-full sm:w-auto">
                <Button size="lg" className="btn-3d w-full px-8 py-6 font-bold uppercase text-base md:text-lg shadow-lg">
                  {t.landing.startTyping}
                </Button>
              </Link>
              <Link href="/leaderboard" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="btn-3d w-full px-8 py-6 font-bold uppercase text-base md:text-lg bg-background/90 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground shadow-lg">
                  {t.landing.viewLeaderboard}
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Ads Banner */}
      {ads && ads.length > 0 && (
        <section className="bg-[#0f0f0f] py-8 border-b border-white/5 flex justify-center">
          <Banner ads={ads} />
        </section>
      )}

      {/* About Us */}
      <section className="py-24 bg-background">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto border border-border bg-card shadow-sm p-8 md:p-12 rounded-2xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Biz Haqimizda</h2>
            <p className="text-muted-foreground md:text-lg leading-relaxed mb-4">
              YOZGO — bu yozish tezligini oshirishni xohlovchilar uchun maxsus platforma.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-secondary/50">
        <div className="container px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard icon={<Zap />} title={t.landing.featureSpeed} description={t.landing.featureSpeedDesc} />
          <FeatureCard icon={<Globe />} title={t.landing.featureMultilingual} description={t.landing.featureMultilingualDesc} />
          <FeatureCard icon={<Users />} title={t.landing.featureBattles} description={t.landing.featureBattlesDesc} />
          <FeatureCard icon={<Trophy />} title={t.landing.featureRankings} description={t.landing.featureRankingsDesc} />
        </div>
      </section>

      {/* Competitions */}
      {competitions && competitions.length > 0 && (
        <section className="relative py-24 overflow-hidden bg-gradient-to-b from-background to-secondary/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background z-0"></div>
          
          <div className="container relative z-10 px-4">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold tracking-wide uppercase text-sm border border-primary/20 mb-4"
              >
                <Trophy className="w-5 h-5" /> Faol Turnirlar
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-black mb-4">Katta Musobaqalar</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Yangi musobaqalarda ishtirok eting va o'z mahoratingizni ko'rsatib, qimmatbaho sovrinlarni yutib oling.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {competitions.map((comp, idx) => (
                <motion.div
                  key={comp.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative p-1 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 shadow-2xl hover:shadow-primary/20 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl -z-10"></div>
                  <div className="h-full bg-card/90 backdrop-blur-xl p-8 rounded-[14px] border border-white/10 flex flex-col items-start relative overflow-hidden">
                    
                    {/* Background Graphic */}
                    <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                      <Zap className="w-48 h-48" />
                    </div>

                    <div className="w-full flex justify-between items-start mb-6 z-10">
                      <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/20 text-orange-500 rounded-xl">
                        <Trophy className="w-8 h-8" />
                      </div>
                      <span className="px-3 py-1 text-xs font-bold bg-green-500/20 text-green-400 rounded-full border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                        Qabul Ochiq
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold mb-3 z-10 group-hover:text-primary transition-colors">{comp.title}</h3>
                    
                    {comp.reward && (
                      <div className="w-full p-4 mb-6 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center z-10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                        <p className="text-xs text-orange-300 uppercase tracking-widest font-black mb-1">Mukofot</p>
                        <p className="text-lg text-orange-400 font-extrabold">{comp.reward}</p>
                      </div>
                    )}
                    
                    <div className="mt-auto w-full z-10">
                      <CompetitionWaitlistModal competition={comp} user={user} queryClient={queryClient} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 border-t mt-auto bg-muted/30">
        <div className="container px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <span className="font-bold text-3xl tracking-tighter">YOZGO</span>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} YOZGO. Barcha huquqlar himoyalangan.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground/60">Hamjamiyat</span>
              <a href="https://t.me/yozgo_uz" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline">@yozgo_uz</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground/60">Yordam (Support)</span>
              <a href="https://t.me/yozgo_support_bot" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline">@yozgo_support_bot</a>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground/60">Platforma</span>
              <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">Reyting</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============ SUB-COMPONENTS ============

/**
 * Xususiyat kartasi (Feature Card).
 */
function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="p-6 bg-card rounded-2xl hover:shadow-lg transition-all group">
      <div className="mb-6 inline-block p-4 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-black uppercase mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

/**
 * Musobaqaga qo'shilish modal oynasi.
 */
function CompetitionWaitlistModal({ competition, user, queryClient }: { competition: any, user: any, queryClient: any }) {
  const [open, setOpen] = useState(false);

  const { data: participants } = useQuery<any[]>({
    queryKey: [`/api/competitions/${competition.id}/participants`],
    enabled: open
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/competitions/${competition.id}/register`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/competitions/${competition.id}/participants`] });
      alert("Muvaffaqiyatli ro'yxatdan o'tdingiz!");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full font-bold">Batafsil</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{competition.title}</DialogTitle>
          <DialogDescription>Musobaqaga tayyorlaning!</DialogDescription>
        </DialogHeader>
        <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "Yuklanmoqda..." : "Qatnashish"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
