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
  prize?: string;
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

  /**
   * 3D Effektli Logo harflarini generatsiya qilish.
   */
  const renderLogoCaps = () => (
    <div className="flex gap-2 sm:gap-4 md:gap-6 mb-12">
      {["Y", "O", "Z", "G", "O"].map((letter, i) => (
        <div
          key={i}
          className="keyboard-key-3d key-hover-ready w-[4.5rem] h-[4.5rem] sm:w-24 sm:h-24 md:w-32 md:h-32 flex items-center justify-center cursor-default select-none group"
        >
          <span className="keyboard-key-text text-4xl sm:text-5xl md:text-7xl group-active:translate-y-[2px] transition-transform">
            {letter}
          </span>
          {(i === 1 || i === 3) && (
            <div className="absolute bottom-[20%] w-[30%] h-[3px] md:h-[4px] bg-[#111] rounded-full z-10 opacity-70 shadow-[0_1px_0_rgba(255,255,255,0.1)] group-active:translate-y-[2px] transition-transform" />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <SEO 
        title="YOZGO | O'zbekiston tez yozish platformasi" 
        description="YOZGO - O'zbekistondagi eng yirik tez yozish va musobaqalar platformasi. Musobaqalarda qatnashing va mahoratingizni oshiring."
      />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-background">
        <div className="container relative z-30 px-4 flex flex-col items-center justify-center pt-10">
          {renderLogoCaps()}

          <div className="text-center max-w-4xl mx-auto flex flex-col items-center mt-4">
            <motion.h2
              className="text-3xl md:text-5xl lg:text-7xl font-sans font-black uppercase text-foreground mb-6 tracking-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {t.landing.heroTitle}
            </motion.h2>

            <motion.div
              className="text-base md:text-2xl text-foreground/90 font-medium mb-12 bg-black/5 px-6 py-3 rounded-full shadow-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {t.landing.heroSubtitle}
            </motion.div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto px-4">
              <Link href="/typing-test">
                <Button size="lg" className="btn-3d w-full sm:w-auto px-10 py-6 font-bold uppercase">
                  {t.landing.startTyping}
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button size="lg" variant="outline" className="btn-3d w-full sm:w-auto px-10 py-6 font-bold uppercase">
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
          <div className="max-w-4xl mx-auto border-t-4 border-foreground bg-black/5 p-8 rounded-2xl text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Biz Haqimizda</h2>
            <p className="text-muted-foreground md:text-lg leading-relaxed mb-4">
              YOZGO — bu yozish tezligini oshirishni xohlovchilar uchun maxsus platforma.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-black/5">
        <div className="container px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard icon={<Zap />} title={t.landing.featureSpeed} description={t.landing.featureSpeedDesc} />
          <FeatureCard icon={<Globe />} title={t.landing.featureMultilingual} description={t.landing.featureMultilingualDesc} />
          <FeatureCard icon={<Users />} title={t.landing.featureBattles} description={t.landing.featureBattlesDesc} />
          <FeatureCard icon={<Trophy />} title={t.landing.featureRankings} description={t.landing.featureRankingsDesc} />
        </div>
      </section>

      {/* Competitions */}
      {competitions && competitions.length > 0 && (
        <section className="py-24 bg-background border-t">
          <div className="container px-4">
            <h2 className="text-3xl font-bold mb-10 text-center">Musobaqalar</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp) => (
                <div key={comp.id} className="p-6 rounded-xl border bg-card flex flex-col items-center">
                  <h3 className="text-xl font-bold mb-2">{comp.title}</h3>
                  <p className="text-amber-500 font-semibold mb-4">🏆 {comp.prize}</p>
                  <CompetitionWaitlistModal competition={comp} user={user} queryClient={queryClient} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 border-t mt-auto bg-black/5">
        <div className="container px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-bold text-2xl">YOZGO</span>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} YOZGO.</p>
          <div className="flex gap-6">
            <a href="https://t.me/yozgo_uz" className="text-primary font-bold">@yozgo_uz</a>
            <Link href="/leaderboard" className="text-muted-foreground">Reyting</Link>
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
