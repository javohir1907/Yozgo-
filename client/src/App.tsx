import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { NavHeader } from "@/components/nav-header";
import LandingPage from "@/pages/landing";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import LeaderboardPage from "@/pages/leaderboard";
import BattlePage from "@/pages/battle";
import TypingTestPage from "@/pages/typing-test";
import ProfilePage from "@/pages/profile";
import AuthPage from "@/pages/auth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/battle" component={BattlePage} />
      <Route path="/typing-test" component={TypingTestPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <I18nProvider>
          <TooltipProvider>
            <div className="flex flex-col min-h-screen bg-background text-foreground">
              <NavHeader />
              <main className="flex-1">
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
