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
import { Zap, Globe, Users, Trophy, ChevronDown } from "lucide-react";

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
import SEO from "@/components/SEO";

// Hooks & Libs
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ============ TYPES ============
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
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

  // Data Fetching
  const { data: competitions } = useQuery<CompetitionEntry[]>({ queryKey: ["/api/competitions"] });

  // ============ RENDER HELPERS ============


  return (
    <div className="flex flex-col min-h-screen">
      <SEO
        title={`YOZGO | ${t.nav.platformTitle}`}
        description={t.landing.readySubtitle}
      />

      {/* Hero — one viewport minus the header (svh for mobile URL bars). */}
      <section className="relative flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center overflow-hidden bg-background px-4 sm:min-h-[calc(100svh-4rem)]">
        {/* Background: a soft brand glow up top and a keycap grid that fades out
            toward the edges via a radial mask — no more uniform, busy grid. */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div
            className="absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black,transparent)]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='72' height='72' viewBox='0 0 72 72' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='6' y='6' width='26' height='26' rx='6' fill='none' stroke='%23f97316' stroke-opacity='0.18' stroke-width='1.5'/%3E%3Crect x='40' y='6' width='26' height='26' rx='6' fill='none' stroke='%23f97316' stroke-opacity='0.18' stroke-width='1.5'/%3E%3Crect x='6' y='40' width='26' height='26' rx='6' fill='none' stroke='%23f97316' stroke-opacity='0.18' stroke-width='1.5'/%3E%3Crect x='40' y='40' width='26' height='26' rx='6' fill='none' stroke='%23f97316' stroke-opacity='0.18' stroke-width='1.5'/%3E%3C/svg%3E")`,
              backgroundSize: "72px 72px",
            }}
          />
          <div className="absolute left-1/2 top-[22%] h-[420px] w-[min(90vw,720px)] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* CSS animate-in, not a JS opacity tween: if the animation never runs
            (reduced motion, a throttled tab) the content stays visible rather
            than stuck at opacity 0. */}
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            {t.landing.aboutUsTitle}
          </span>

          <h1 className="font-heading text-display font-extrabold leading-[1.02] tracking-tight text-foreground">
            {t.landing.heroTitle}
          </h1>

          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t.landing.heroSubtitle}
          </p>

          <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="w-full px-8 font-bold sm:w-auto">
              <Link href="/typing-test">{t.landing.startTyping}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full px-8 font-bold sm:w-auto">
              <Link href="/leaderboard">{t.landing.viewLeaderboard}</Link>
            </Button>
          </div>

          {/* Feature chips — quiet social proof under the fold-line. */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t.landing.featureSpeed}
            </span>
            <span className="inline-flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t.landing.featureMultilingual}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t.landing.featureBattles}
            </span>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-muted-foreground/40">
          <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden="true" />
        </div>
      </section>

      {/* About Section - Competitive Branding */}
      <section className="py-20 md:py-28 relative overflow-hidden bg-background">
        <div className="container px-4">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20 p-8 md:p-16 rounded-[2.5rem] bg-card border border-border shadow-2xl relative">
            
            {/* Background Accent */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-3xl rounded-full"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-info/10 blur-3xl rounded-full"></div>

            <div className="flex-1 text-center md:text-left z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest mb-6 border border-primary/20">
                <Users className="w-3.5 h-3.5" /> {t.landing.aboutUsTitle}
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">
                {t.nav.platformTitle}
              </h2>
              <p className="text-foreground md:text-xl font-medium leading-relaxed mb-6 italic border-l-4 border-primary pl-6">
                "{t.landing.aboutUsP1}"
              </p>
              <p className="text-muted-foreground md:text-lg leading-relaxed">
                {t.landing.aboutUsP2}
              </p>
              
              <div className="mt-10 flex items-center justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary border border-border">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                  <span className="text-sm font-bold uppercase tracking-tight">{t.landing.aboutUsSystem}</span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-[30%] flex justify-center z-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-110"></div>
                <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full bg-secondary flex items-center justify-center shadow-xl border border-border overflow-hidden">
                   <Trophy className="w-16 h-16 md:w-24 md:h-24 text-primary drop-shadow-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
      </section>

      {/* Features Grid */}
      <section className="border-y border-border bg-secondary/30 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.landing.featuresTitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={<Zap />} title={t.landing.featureSpeed} description={t.landing.featureSpeedDesc} />
            <FeatureCard icon={<Globe />} title={t.landing.featureMultilingual} description={t.landing.featureMultilingualDesc} />
            <FeatureCard icon={<Users />} title={t.landing.featureBattles} description={t.landing.featureBattlesDesc} />
            <FeatureCard icon={<Trophy />} title={t.landing.featureRankings} description={t.landing.featureRankingsDesc} />
          </div>
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
                <Trophy className="w-5 h-5" /> {t.landing.compActiveTournaments}
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-black mb-4">{t.landing.upcomingComps}</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {t.landing.readySubtitle}
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
                  className="group relative p-1 rounded-2xl bg-gradient-to-br from-border to-transparent shadow-2xl hover:shadow-primary/20 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl -z-10"></div>
                  <div className="h-full bg-card/90 backdrop-blur-xl p-8 rounded-[14px] border border-border flex flex-col items-start relative overflow-hidden">
                    
                    {/* Background Graphic */}
                    <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                      <Zap className="w-48 h-48" />
                    </div>

                    <div className="w-full flex justify-between items-start mb-6 z-10">
                      <div className="p-3 bg-primary/15 text-primary rounded-xl">
                        <Trophy className="w-8 h-8" />
                      </div>
                      <span className="px-3 py-1 text-xs font-bold bg-success/15 text-success rounded-full border border-success/30">
                        {t.landing.compOpen}
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold mb-3 z-10 group-hover:text-primary transition-colors">{comp.title}</h3>
                    
                    {comp.reward && (
                      <div className="w-full p-4 mb-6 rounded-xl bg-primary/10 border border-primary/20 text-center z-10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent -translate-x-full animate-shimmer"></div>
                        <p className="text-xs text-primary/80 uppercase tracking-widest font-black mb-1">{t.landing.compReward}</p>
                        <p className="text-lg text-primary font-extrabold">{comp.reward}</p>
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

      {/* Footer is now app-wide (AppFooter, mounted in App.tsx). */}
    </div>
  );
}

// ============ SUB-COMPONENTS ============

/**
 * Xususiyat kartasi (Feature Card).
 */
function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group rounded-xl border border-card-border bg-card p-6 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground [&_svg]:h-6 [&_svg]:w-6">
        {icon}
      </div>
      <h3 className="mb-2 font-heading text-lg font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Musobaqaga qo'shilish modal oynasi.
 */
function CompetitionWaitlistModal({ competition, queryClient }: { competition: any, user: any, queryClient: any }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();

  const registerMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/competitions/${competition.id}/register`);
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competitions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/competitions/${competition.id}/participants`] });
      // Was a native alert() — bypassed the app's toast system entirely.
      toast({ variant: "success", title: t.landing.compRegistered });
      setOpen(false);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full font-bold">{t.landing.compDetails}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{competition.title}</DialogTitle>
          <DialogDescription>{t.landing.compGetReady}</DialogDescription>
        </DialogHeader>
        <Button loading={registerMutation.isPending} onClick={() => registerMutation.mutate()}>
          {t.landing.compJoin}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
