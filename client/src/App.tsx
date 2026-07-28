import React from "react";
import { Switch, Route, useLocation } from "wouter";
import ReactGA from "react-ga4";
ReactGA.initialize("G-TSXDSPDL98");
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { NavHeader } from "@/components/nav-header";
import { AppErrorBoundary } from "@/components/layout/error-boundary";
import { SkipLink } from "@/components/layout/skip-link";
import { AppFooter } from "@/components/layout/app-footer";
import { Loader2 } from "lucide-react";

const LandingPage = React.lazy(() => import("@/pages/landing"));
const SettingsPage = React.lazy(() => import("@/pages/settings"));
const NotFound = React.lazy(() => import("@/pages/not-found"));
const LeaderboardPage = React.lazy(() => import("@/pages/leaderboard"));
const LeaguePage = React.lazy(() => import("@/pages/league"));
const QuestsPage = React.lazy(() => import("@/pages/quests"));
const ShopPage = React.lazy(() => import("@/pages/shop"));
const FriendsPage = React.lazy(() => import("@/pages/friends"));
const BattlePage = React.lazy(() => import("@/pages/battle"));
const TypingTestPage = React.lazy(() => import("@/pages/typing-test"));
const ProfilePage = React.lazy(() => import("@/pages/profile"));
const AuthPage = React.lazy(() => import("@/pages/auth"));
const ResetPasswordPage = React.lazy(() => import("@/pages/reset-password"));
const AdminPage = React.lazy(() => import("@/pages/admin"));


function Router() {
  const [location, setLocation] = useLocation();

  React.useEffect(() => {
    if (location !== "/" && location.endsWith("/")) {
      setLocation(location.slice(0, -1), { replace: true });
    }

    ReactGA.send({ hitType: "pageview", page: location });
  }, [location, setLocation]);

  return (
    <AppErrorBoundary scope="route" resetKeys={[location]}>
    <React.Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      {/* A CSS fade keyed on location — replaces AnimatePresence mode="wait",
          which gated the new page's mount on the old page's exit animation
          (stacked on top of the lazy-chunk fetch) and could freeze a page at
          opacity 0 in a throttled tab. CSS animate-in degrades to "visible". */}
      <div key={location} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/league" component={LeaguePage} />
          <Route path="/quests" component={QuestsPage} />
          <Route path="/shop" component={ShopPage} />
          <Route path="/friends" component={FriendsPage} />
          <Route path="/battle" component={BattlePage} />
          <Route path="/typing-test" component={TypingTestPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/profile/:userId" component={ProfilePage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </React.Suspense>
    </AppErrorBoundary>
  );
}

// Footer is app-wide except on the two focus surfaces, where chrome competes
// with the typing task. It used to live inside landing.tsx, i.e. on one route.
const FOOTERLESS = new Set(["/typing-test", "/battle"]);
function AppFooterSlot() {
  const [location] = useLocation();
  if (FOOTERLESS.has(location)) return null;
  return <AppFooter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <TooltipProvider>
            <div className="flex flex-col min-h-screen bg-background text-foreground">
              <SkipLink />
              <NavHeader />
              <main id="main" className="flex flex-1 flex-col pt-14 sm:pt-16">
                <Router />
              </main>
              <AppFooterSlot />
            </div>
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
