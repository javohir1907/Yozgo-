import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Keyboard, Zap, Globe, Users, Trophy, Star, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";

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
    }
  });

  return (
    <div className="flex flex-col min-h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        .font-bebas { font-family: 'Bebas Neue', display, sans-serif; letter-spacing: 0.05em; }
        .bg-dot-pattern {
          background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px);
          background-size: 24px 24px;
        }
      `}} />
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-[#0f0f0f] border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=2071&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] mix-blend-screen" />
          <div className="absolute inset-0 bg-dot-pattern opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/80 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f0f] via-transparent to-[#0f0f0f] z-10" />
        </div>

        <div className="container relative z-20 px-4 flex flex-col items-center justify-center pt-10">
          {/* Logo Keycaps */}
          <motion.div 
            className="flex gap-3 md:gap-6 mb-12"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            initial="hidden"
            animate="visible"
          >
            {["Y", "O", "Z", "G", "O"].map((letter, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: -60, rotateX: 45 },
                  visible: { 
                    opacity: 1, 
                    y: 0, 
                    rotateX: 0,
                    transition: { type: "spring", stiffness: 200, damping: 15 } 
                  }
                }}
                className="w-[4.5rem] h-[4.5rem] sm:w-24 sm:h-24 md:w-32 md:h-32 flex items-center justify-center rounded-xl md:rounded-2xl bg-gradient-to-b from-[#333] to-[#1a1a1a] shadow-[inset_0_2px_4px_rgba(255,255,255,0.2),0_8px_0_#000,0_12px_24px_rgba(0,0,0,0.9)] border-2 border-gray-600/50 hover:-translate-y-1 hover:shadow-[inset_0_2px_6px_rgba(255,255,255,0.3),0_10px_0_#000,0_18px_30px_rgba(0,0,0,1)] transition-all cursor-default select-none"
              >
                <span className={`text-5xl sm:text-6xl md:text-8xl font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] font-mono ${i === 0 ? 'text-orange-500' : 'text-gray-100'}`}>
                  {letter}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Texts */}
          <div className="text-center max-w-4xl mx-auto flex flex-col items-center">
            <motion.h1 
              className="text-4xl md:text-6xl lg:text-7xl font-bebas text-white mb-4 drop-shadow-md whitespace-pre-wrap"
              variants={{
                hidden: { opacity: 1 },
                visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.8 } }
              }}
              initial="hidden"
              animate="visible"
            >
              {t.landing.heroTitle.split("").map((char, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 }
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </motion.h1>

            <motion.div 
              className="text-base md:text-2xl text-gray-400 font-medium mb-10 flex items-center justify-center min-h-[40px] flex-wrap max-w-[90%] whitespace-pre-wrap"
              variants={{
                hidden: { opacity: 1 },
                visible: { opacity: 1, transition: { staggerChildren: 0.03, delayChildren: 2.0 } }
              }}
              initial="hidden"
              animate="visible"
            >
              {t.landing.heroSubtitle.split("").map((char, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1 }
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 3.5 }}
                className="inline-block w-2 h-5 md:h-7 bg-orange-500 ml-1"
              />
            </motion.div>

            {/* Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center w-full sm:w-auto px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.5, duration: 0.5 }}
            >
              <Link href="/typing-test">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white border-b-[5px] border-orange-800 active:border-b-0 active:translate-y-[5px] transition-all"
                >
                  Musobaqani boshlash
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full sm:w-auto text-lg px-8 py-6 rounded-xl border-white/20 text-white hover:bg-white/10 hover:text-white transition-all bg-transparent backdrop-blur-sm"
                >
                  Reyting
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {ads && ads.length > 0 && (
        <section className="bg-muted/50 py-6 border-b">
          <div className="container px-4 flex justify-center gap-6 flex-wrap">
            {ads.map((ad: any) => (
              <a key={ad.id} href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full max-w-[400px] hover:scale-[1.02] transition-transform duration-300">
                <img src={ad.imageUrl} alt={ad.title} className="w-full h-auto rounded-lg shadow-md border object-cover min-h-[100px]" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="py-24 bg-background">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto border-l-4 border-orange-500 bg-orange-500/5 p-8 rounded-r-2xl shadow-sm">
            <h2 className="text-3xl font-bold mb-6 text-foreground">Biz Haqimizda</h2>
            <div className="space-y-4 text-muted-foreground md:text-lg leading-relaxed text-left">
              <p>
                <strong className="text-orange-500 font-semibold text-xl">YOZGO</strong> — bu yozish tezligini oshirish va o'z ustida ishlashni xohlovchilar uchun maxsus yaratilgan platforma. Bizning maqsadimiz har bir foydalanuvchiga o'z klaviatura ko'nikmalarini qiziqarli va raqobatbardosh usulda rivojlantirishga yordam berishdir.
              </p>
              <p>
                Loyiha qisqa vaqt ichida o'zbek tilidagi eng qulay yozish trenajyoriga aylandi. Biz foydalanuvchilar orasida musobaqalar o'tkazish, reyting tizimi orqali sog'lom raqobatni shakllantirish va yangi marralarni zabt etish imkoniyatini taqdim etamiz.
              </p>
              <p>
                Bizning jamoamiz texnologiya va ta'lim sohasiga qiziquvchi yosh dasturchilardan iborat. Har kuni platformani yanada qulay va zamonaviy qilish ustida ish olib boramiz.
              </p>
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

      <section className="py-24 border-t">
        <div className="container px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">{t.landing.readyTitle}</h2>
          <p className="text-muted-foreground mb-10 max-w-[500px] mx-auto">
            {t.landing.readySubtitle}
          </p>
          <Link href="/typing-test">
            <Button size="lg" className="rounded-full px-12" data-testid="button-get-started">
              {t.landing.getStarted}
            </Button>
          </Link>
        </div>
      </section>

      {competitions && competitions.length > 0 && (
        <section className="py-24 bg-card/10 border-t">
          <div className="container px-4">
            <h2 className="text-3xl font-bold mb-10 text-center">Yaqinda bo'ladigan musobaqalar</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {competitions.map((comp: any) => (
                <div key={comp.id} className="p-6 rounded-xl border bg-card hover:border-primary/50 transition-colors shadow-sm">
                  <h3 className="text-xl font-bold mb-2">{comp.title}</h3>
                  {comp.prize && <p className="text-amber-500 font-semibold mb-4">🏆 Sovrin: {comp.prize}</p>}
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
                            <Star key={i} className={`w-4 h-4 ${i < rev.rating ? "fill-current" : "text-muted opacity-30"}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-muted-foreground">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">Mijozlarimiz hozircha fikr qoldirishmagan.</p>
              )}
            </div>

            <div>
              <div className="p-6 rounded-xl border bg-background shadow-md">
                <h3 className="text-xl font-semibold mb-6">Fikr qoldirish</h3>
                {user ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if(comment.trim()) submitReview.mutate({ rating, comment });
                  }} className="space-y-4">
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
                            <Star className={`w-8 h-8 ${s <= rating ? "text-yellow-500 fill-current" : "text-muted opacity-30"}`} />
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
                    <p className="text-muted-foreground mb-4">Fikr qoldirish uchun tizimga kirishingiz kerak.</p>
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
            <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-600 rounded-md flex items-center justify-center text-white font-black text-xl md:text-2xl shadow-sm border border-orange-400">Y</div>
            <span className="text-white text-2xl tracking-wider">YOZGO</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} YOZGO. {t.landing.footer}
          </p>
          <div className="flex gap-6">
            <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-settings">{t.nav.settings}</Link>
            <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-leaderboard">{t.nav.leaderboard}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-xl border bg-card hover-elevate transition-all">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function Countdown({ date }: { date: string }) {
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, mins: number} | null>(null);

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
        mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
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
    <span className="font-medium">{timeLeft.days} kun, {timeLeft.hours} soat, {timeLeft.mins} daq.</span>
  );
}
