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
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-background border-b border-primary/20">
        {/* Animated HUD Background Effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-screen" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-10" />
          <div className="absolute top-1/4 left-0 w-full h-[1px] bg-primary/20 shadow-[0_0_10px_var(--primary)] animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
          <div className="absolute top-3/4 left-0 w-full h-[1px] bg-primary/20 shadow-[0_0_10px_var(--primary)] animate-[ping_6s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
          {/* Scanning line */}
          <motion.div
            className="absolute left-0 w-full h-[2px] bg-primary/50 shadow-[0_0_15px_var(--primary)] z-20"
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 8, ease: "linear", repeat: Infinity }}
          />
        </div>

        <div className="container relative z-30 px-4 flex flex-col items-center justify-center pt-10">
          {/* Sci-Fi Title/Logo Area */}
          <motion.div
            className="flex flex-col items-center mb-10 relative"
            variants={{
              hidden: { opacity: 0, scale: 0.8 },
              visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: "easeOut" } },
            }}
            initial="hidden"
            animate="visible"
          >
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150"></div>
            <div className="relative border border-primary/30 bg-background/50 backdrop-blur-sm p-4 px-10 flex items-center justify-center overflow-hidden group">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
              <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading font-black tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-200 to-primary drop-shadow-[0_0_15px_rgba(0,240,255,0.8)] z-10">
                YOZGO
              </h1>
              
              {/* Ticker tape effect */}
              <div className="absolute bottom-1 left-0 w-full flex opacity-50 space-x-2">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="h-[2px] w-2 bg-primary"></div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Texts */}
          <div className="text-center max-w-4xl mx-auto flex flex-col items-center mt-4">
            <motion.h2
              className="text-2xl md:text-4xl lg:text-5xl font-heading uppercase text-foreground mb-6 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] whitespace-pre-wrap tracking-wider"
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
                    hidden: { opacity: 0, filter: "blur(10px)" },
                    visible: { opacity: 1, filter: "blur(0px)" },
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </motion.h2>

            <motion.div
              className="text-sm md:text-xl text-primary/80 font-mono mb-12 flex items-center justify-center min-h-[40px] flex-wrap max-w-[90%] whitespace-pre-wrap uppercase tracking-widest bg-primary/5 border border-primary/20 px-6 py-3"
              variants={{
                hidden: { opacity: 1 },
                visible: { opacity: 1, transition: { staggerChildren: 0.02, delayChildren: 1.5 } },
              }}
              initial="hidden"
              animate="visible"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent"></div>
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
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 2.5 }}
                className="inline-block w-2 md:w-3 h-4 md:h-5 bg-primary ml-2 shadow-[0_0_8px_var(--primary)]"
              />
            </motion.div>

            {/* Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto px-4 z-30"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.5, duration: 0.5 }}
            >
              <Link href="/typing-test">
                <Button
                  size="lg"
                  className="w-full sm:w-auto text-sm md:text-base px-10 py-6 font-heading tracking-widest uppercase bg-primary/20 text-primary border border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_25px_var(--primary)] transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 w-full h-full bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <span className="relative">Musobaqani boshlash</span>
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-sm md:text-base px-10 py-6 font-heading tracking-widest uppercase border border-primary/40 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 backdrop-blur-sm"
                >
                  Reyting
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
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent blur-3xl pointer-events-none" />
        <div className="container px-4 relative z-10">
          <div className="max-w-4xl mx-auto border-l-4 border-primary bg-primary/5 p-8 shadow-[0_0_30px_rgba(0,240,255,0.05)] backdrop-blur-sm relative glass-panel">
            {/* HUD Corner Decor */}
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary/50"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary/50"></div>
            
            <h2 className="text-3xl lg:text-4xl font-heading font-bold mb-6 text-foreground tracking-widest uppercase flex items-center gap-3">
              <span className="w-2 h-8 bg-primary shadow-[0_0_10px_var(--primary)] inline-block"></span>
              Biz Haqimizda
            </h2>
            <div className="space-y-6 text-muted-foreground md:text-lg leading-relaxed text-left font-sans">
              <p>
                <strong className="text-primary font-heading tracking-wider">YOZGO</strong> — bu yozish
                tezligini oshirish va o'z ustida ishlashni xohlovchilar uchun maxsus ishlab
                chiqilgan avangard platforma. Bizning maqsadimiz har bir foydalanuvchiga o'z klaviatura
                ko'nikmalarini qiziqarli va raqobatbardosh usulda maxsus vizual interfeys orqali rivojlantirishga yordam berishdir.
              </p>
              <p>
                Loyiha qisqa vaqt ichida o'zbek tilidagi eng ilg'or yozish trenajyoriga aylandi. Biz
                foydalanuvchilar orasida musobaqalar o'tkazish, FUI (Futuristic User Interface) reyting tizimi orqali sog'lom
                raqobatni shakllantiramiz.
              </p>
              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-primary/20">
                <div className="w-12 h-12 flex items-center justify-center border border-primary/50 text-primary shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                  <span className="font-heading font-bold">1</span>
                </div>
                <div className="flex-1">
                  <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-2/3 shadow-[0_0_5px_var(--primary)] animate-pulse"></div>
                  </div>
                  <p className="text-xs font-mono text-primary/70 mt-2 uppercase">System Status: Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card/30 border-t">
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

      <section className="py-24 border-t border-primary/20 bg-background relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-primary/30 to-transparent"></div>
        <div className="container px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-heading font-black tracking-widest uppercase mb-6 text-foreground text-shadow-glow">
            {t.landing.readyTitle}
          </h2>
          <p className="text-muted-foreground font-mono mb-10 max-w-[500px] mx-auto opacity-80">
            &gt; {t.landing.readySubtitle}_
          </p>
          <Link href="/typing-test">
            <Button size="lg" className="px-12 py-6 font-heading tracking-widest uppercase bg-primary/20 text-primary border border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_25px_var(--primary)] transition-all duration-300" data-testid="button-get-started">
              {t.landing.getStarted}
            </Button>
          </Link>
        </div>
      </section>

      {competitions && competitions.length > 0 && (
        <section className="py-24 bg-card/10 border-t">
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
                  className="p-6 rounded-xl border bg-card hover:border-primary/50 transition-colors shadow-sm"
                >
                  <h3 className="text-xl font-bold mb-2">{comp.title}</h3>
                  {comp.prize && (
                    <p className="text-amber-500 font-semibold mb-4">🏆 Sovrin: {comp.prize}</p>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground mb-6">
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

      <section className="py-24 bg-card/30 border-t">
        <div className="container px-4">
          <h2 className="text-3xl font-bold mb-10 text-center">Fikr va Mulohazalar</h2>

          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="space-y-6">
              <h3 className="text-xl font-semibold mb-4">Foydalanuvchilarimiz nima deydi?</h3>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((rev: any) => (
                    <div key={rev.id} className="p-4 rounded-lg bg-background border shadow-sm">
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
              <div className="p-6 rounded-xl border bg-background shadow-md">
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

      <footer className="py-12 border-t mt-auto">
        <div className="container px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 font-bold text-xl">
            <span className="text-white text-2xl tracking-wider">YOZGO</span>
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
    <div className="p-6 border border-primary/30 bg-background/50 backdrop-blur hover:bg-primary/5 hover:border-primary transition-all duration-300 group relative">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="mb-6 inline-block p-3 border border-primary/20 bg-background group-hover:shadow-[0_0_15px_var(--primary)] transition-all">
        {icon}
      </div>
      <h3 className="text-xl font-heading font-bold uppercase tracking-wider mb-2 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-muted-foreground font-sans text-sm md:text-base leading-relaxed">{description}</p>
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
