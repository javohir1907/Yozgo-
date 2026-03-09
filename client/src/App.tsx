import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { NavHeader } from "@/components/nav-header";
import LandingPage from "@/pages/landing";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import LeaderboardPage from "@/pages/leaderboard";
import BattlePage from "@/pages/battle";
import TypingTestPage from "@/pages/typing-test";
import ProfilePage from "@/pages/profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/battle" component={BattlePage} />
      <Route path="/typing-test" component={TypingTestPage} />
      <Route path="/profile" component={ProfilePage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <div className="flex flex-col min-h-screen bg-background text-foreground">
            <NavHeader />
            <main className="flex-1">
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
