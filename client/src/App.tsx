import React from "react";
import { Switch, Route, useLocation } from "wouter";
import ReactGA from "react-ga4";
ReactGA.initialize("G-56W2C1S1FV");
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { NavHeader } from "@/components/nav-header";
import { Loader2 } from "lucide-react";

const LandingPage = React.lazy(() => import("@/pages/landing"));
const SettingsPage = React.lazy(() => import("@/pages/settings"));
const NotFound = React.lazy(() => import("@/pages/not-found"));
const LeaderboardPage = React.lazy(() => import("@/pages/leaderboard"));
const BattlePage = React.lazy(() => import("@/pages/battle"));
const TypingTestPage = React.lazy(() => import("@/pages/typing-test"));
const ProfilePage = React.lazy(() => import("@/pages/profile"));
const AuthPage = React.lazy(() => import("@/pages/auth"));
const AdminPage = React.lazy(() => import("@/pages/admin"));
const ResetPasswordPage = React.lazy(() => import("@/pages/reset-password"));

import { motion, AnimatePresence } from "framer-motion";

function Router() {
  const [location, setLocation] = useLocation();

  React.useEffect(() => {
    if (location !== "/" && location.endsWith("/")) {
      setLocation(location.slice(0, -1), { replace: true });
    }
    
    // Intercept Google Token for Safari ITP fallback
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("googleToken");
    if (token) {
      localStorage.setItem("yozgo_session", token);
      searchParams.delete("googleToken");
      const newUrl = window.location.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }

    ReactGA.send({ hitType: "pageview", page: location });
  }, [location, setLocation]);

  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="h-full w-full"
        >
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/auth" component={AuthPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/leaderboard" component={LeaderboardPage} />
            <Route path="/battle" component={BattlePage} />
            <Route path="/typing-test" component={TypingTestPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/profile/:userId" component={ProfilePage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/reset-password" component={ResetPasswordPage} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </React.Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <TooltipProvider>
            <div className="flex flex-col min-h-screen bg-background text-foreground">
              <NavHeader />
              <main className="flex-1 pt-14 sm:pt-16">
                <Router />
              </main>
            </div>
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
