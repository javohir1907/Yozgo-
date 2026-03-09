import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Keyboard, Zap, Globe, Users, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-background">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90 z-10" />
        </div>
        
        <div className="container relative z-20 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 text-foreground">
              {t.landing.heroTitle} <span className="text-primary">YOZGO</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] mx-auto mb-8">
              {t.landing.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/typing-test">
                <Button size="lg" className="text-lg px-8" data-testid="link-start-typing">
                  {t.landing.startTyping}
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button size="lg" variant="outline" className="text-lg px-8" data-testid="link-view-leaderboard">
                  {t.landing.viewLeaderboard}
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div 
            className="mt-16 p-6 rounded-lg border bg-card/50 backdrop-blur-sm max-w-2xl mx-auto hidden md:block"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4 border-b pb-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="text-xs text-muted-foreground ml-2 font-mono">typing_demo.js</span>
            </div>
            <p className="text-2xl font-mono text-left leading-relaxed">
              <span className="text-correct">The</span> <span className="text-correct">quick</span> <span className="text-correct">brown</span> <span className="text-error">foks</span><span className="animate-pulse border-l-2 border-caret ml-1" /> <span className="text-pending">jumps over the lazy dog...</span>
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-24 bg-card/30">
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
      
      <footer className="py-12 border-t mt-auto">
        <div className="container px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Keyboard className="w-6 h-6 text-primary" />
            <span>YOZGO</span>
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
