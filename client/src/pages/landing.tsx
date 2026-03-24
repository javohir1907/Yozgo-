import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Keyboard, Zap, Globe, Users, Trophy, Star, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Banner } from "@/components/banner";

export default function LandingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: ads } = useQuery<any[]>({ queryKey: ["/api/advertisements"] });
  const { data: competitions } = useQuery<any[]>({ queryKey: ["/api/competitions"] });
  const { data: reviews } = useQuery<any[]>({ queryKey: ["/api/reviews"] });

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

  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-background">
        <div className="absolute inset-0 z-0">
          {/* <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-multiply" /> */}
        </div>

        <div className="container relative z-30 px-4 flex flex-col items-center justify-center pt-10">
          {/* Logo 3D Keycaps */}
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

          {/* Texts */}
          <div className="text-center max-w-4xl mx-auto flex flex-col items-center mt-4">
            <motion.h2
              className="text-3xl md:text-5xl lg:text-7xl font-sans font-black uppercase text-foreground mb-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)] whitespace-pre-wrap tracking-tight"
              variants={{
                hidden: { opacity: 1 },
                visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.5 } },
              }}
              initial="hidden"
              animate="visible"
            >
              {t.landing.heroTitle.split("").map((char, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </motion.h2>

            <motion.div
              className="text-base md:text-2xl text-foreground/90 font-medium mb-12 flex items-center justify-center min-h-[40px] flex-wrap max-w-[90%] whitespace-pre-wrap font-sans bg-black/5 px-6 py-3 rounded-full shadow-sm"
              variants={{
                hidden: { opacity: 1 },
                visible: { opacity: 1, transition: { staggerChildren: 0.02, delayChildren: 1.5 } },
              }}
              initial="hidden"
              animate="visible"
            >
              {t.landing.heroSubtitle.split("").map((char, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 },
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </motion.div>

            {/* Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto px-4 z-30"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.0, duration: 0.5 }}
            >
              <Link href="/typing-test">
                <Button
                  size="lg"
                  className="btn-3d w-full sm:w-auto text-sm md:text-base px-10 py-6 font-bold uppercase bg-[#242424] text-white hover:bg-[#1a1a1a] shadow-[0_6px_0_#111,0_8px_10px_rgba(0,0,0,0.5)] rounded-xl border-t-[1.5px] border-white/10"
                >
                  {t.landing.startTyping}
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-3d w-full sm:w-auto text-sm md:text-base px-10 py-6 font-bold uppercase bg-white/10 text-white hover:bg-white/20 hover:text-white border-none shadow-[0_6px_0_rgba(0,0,0,0.2)] rounded-xl"
                >
                  {t.landing.viewLeaderboard}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {ads && ads.length > 0 && (
        <section className="bg-[#0f0f0f] py-8 border-b border-white/5">
          <div className="container px-4 flex justify-center">
            <Banner ads={ads} />
          </div>
        </section>
      )}

      <section className="py-24 bg-background relative overflow-hidden">
        <div className="container px-4 relative z-10">
          <div className="max-w-4xl mx-auto border-t-4 border-foreground bg-black/5 p-8 shadow-sm rounded-2xl text-center">
            
            <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-foreground tracking-tight flex items-center justify-center gap-3">
              {(t.landing as any).aboutUsTitle || "Biz Haqimizda"}
            </h2>
            <div className="space-y-4 text-muted-foreground md:text-lg leading-relaxed text-center font-sans">
              <p>
                {(t.landing as any).aboutUsP1 || "YOZGO — bu yozish tezligini oshirish va o'z ustida ishlashni xohlovchilar uchun maxsus ishlab chiqilgan platforma. Bizning maqsadimiz har bir foydalanuvchiga o'z klaviatura ko'nikmalarini qiziqarli va raqobatbardosh usulda rivojlantirishga yordam berishdir."}
              </p>
              <p>
                {(t.landing as any).aboutUsP2 || "Loyiha qisqa vaqt ichida eng qulay yozish trenajyoriga aylandi. Biz foydalanuvchilar orasida musobaqalar o'tkazish barobarida reyting tizimi orqali sog'lom raqobatni shakllantiramiz."}
              </p>
              <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-foreground/10 text-foreground rounded-full font-medium text-sm">
                <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
                {(t.landing as any).aboutUsSystem || "System Status: Active"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-black/5">
        <div className="container px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Zap className="w-10 h-10 text-primary" />}
              title={t.landing.featureSpeed}
              description={t.landing.featureSpeedDesc}
            />
            <FeatureCard
              icon={<Globe className="w-10 h-10 text-primary" />}
              title={t.landing.featureMultilingual}
              description={t.landing.featureMultilingualDesc}
            />
            <FeatureCard
              icon={<Users className="w-10 h-10 text-primary" />}
              title={t.landing.featureBattles}
              description={t.landing.featureBattlesDesc}
            />
            <FeatureCard
              icon={<Trophy className="w-10 h-10 text-primary" />}
              title={t.landing.featureRankings}
              description={t.landing.featureRankingsDesc}
            />
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-foreground">
            {t.landing.readyTitle}
          </h2>
          <p className="text-muted-foreground mb-10 max-w-[500px] mx-auto text-lg">
            {t.landing.readySubtitle}
          </p>
          <Link href="/typing-test">
            <Button size="lg" className="btn-3d px-12 py-6 font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-[0_6px_0_hsl(var(--primary)/0.5)]" data-testid="button-get-started">
              {t.landing.getStarted}
            </Button>
          </Link>
        </div>
      </section>

      {competitions && competitions.length > 0 && (
        <section className="py-24 bg-black/5 border-t border-black/5">
          <div className="container px-4">
            <h2 className="text-3xl font-bold mb-10 text-center">Yaqinda bo'ladigan musobaqalar</h2>
            {ads && ads.length > 0 && (
              <div className="mb-10 w-full flex justify-center">
                <Banner ads={ads} />
              </div>
            )}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp: any) => (
                <div
                  key={comp.id}
                  className="p-6 rounded-xl border bg-card hover:border-primary/50 transition-colors shadow-sm flex flex-col items-center text-center"
                >
                  <h3 className="text-xl font-bold mb-2">{comp.title}</h3>
                  {comp.prize && (
                    <p className="text-amber-500 font-semibold mb-4">🏆 Sovrin: {comp.prize}</p>
                  )}
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
                    <Clock className="w-4 h-4" />
                    <Countdown date={comp.date} />
                  </div>
                  <Link href="/battle">
                    <Button className="w-full">Qatnashish</Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-24 bg-background border-t border-black/5">
        <div className="container px-4">
          <h2 className="text-3xl font-bold mb-10 text-center">Fikr va Mulohazalar</h2>

          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Foydalanuvchilarimiz nima deydi?</h3>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((rev: any) => (
                    <div key={rev.id} className="p-4 rounded-lg bg-black/5 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{rev.user.username}</span>
                        <div className="flex text-yellow-500">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${i < rev.rating ? "fill-current" : "text-muted opacity-30"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-muted-foreground">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">
                  Mijozlarimiz hozircha fikr qoldirishmagan.
                </p>
              )}
            </div>

            <div>
              <div className="p-6 rounded-xl bg-black/5 shadow-sm">
                <h3 className="text-xl font-semibold mb-6">Fikr qoldirish</h3>
                {user ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (comment.trim()) submitReview.mutate({ rating, comment });
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium mb-2">Baholang</label>
                      <div className="flex gap-1 mb-4">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setRating(s)}
                            className="focus:outline-none transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-8 h-8 ${s <= rating ? "text-yellow-500 fill-current" : "text-muted opacity-30"}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Izohingiz</label>
                      <textarea
                        className="w-full min-h-[100px] p-3 rounded-md border bg-transparent focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Saytdan qanday taassurot oldingiz?"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={submitReview.isPending} className="w-full">
                      Yuborish
                    </Button>
                  </form>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">
                      Fikr qoldirish uchun tizimga kirishingiz kerak.
                    </p>
                    <Link href="/auth">
                      <Button variant="outline">Tizimga kirish</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-black/10 mt-auto bg-black/5">
        <div className="container px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 font-bold text-xl">
            <span className="text-foreground text-2xl tracking-wider">YOZGO</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} YOZGO. {t.landing.footer}
          </p>
          <div className="flex gap-6">
            <Link
              href="/settings"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-footer-settings"
            >
              {t.nav.settings}
            </Link>
            <Link
              href="/leaderboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-footer-leaderboard"
            >
              {t.nav.leaderboard}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-black/5 rounded-2xl hover:bg-black/10 transition-all duration-300 group relative">
      <div className="mb-6 inline-block p-4 rounded-xl bg-black/5 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-heading font-black uppercase tracking-wider mb-2 group-hover:translate-x-1 transition-transform">{title}</h3>
      <p className="text-foreground/80 font-sans text-sm md:text-base leading-relaxed">{description}</p>
    </div>
  );
}

function Countdown({ date }: { date: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; mins: number } | null>(
    null
  );

  useEffect(() => {
    const target = new Date(date).getTime();

    // Initial evaluation
    const evaluateTime = () => {
      const distance = target - new Date().getTime();
      if (distance < 0) {
        setTimeLeft(null);
        return false;
      }
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      });
      return true;
    };

    if (evaluateTime()) {
      const interval = setInterval(() => {
        if (!evaluateTime()) clearInterval(interval);
      }, 60000); // Check every minute instead of second to avoid too frequent renders
      return () => clearInterval(interval);
    }
  }, [date]);

  if (!timeLeft) return <span>Boshlanib bo'ldi yoku tugadi!</span>;

  return (
    <span className="font-medium">
      {timeLeft.days} kun, {timeLeft.hours} soat, {timeLeft.mins} daq.
    </span>
  );
}
