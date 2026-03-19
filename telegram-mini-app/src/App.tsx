import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home, Trophy, List, User as UserIcon } from 'lucide-react'
import HomePage from './pages/Home'
import CompetitionsPage from './pages/Competitions'
import LeaderboardPage from './pages/Leaderboard'
import ProfilePage from './pages/Profile'
import { cn } from './lib/utils'

export const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://yozgo.uz/api';

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const initData = (window as any).Telegram?.WebApp?.initData;
    if (initData) {
      fetch(`${API_URL}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      })
      .then(res => res.json())
      .then(data => {
        if (data.id) setUser(data);
        else setError(data.message || 'Auth failed');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

      // Enable closing confirmation & expand
      (window as any).Telegram?.WebApp?.expand();
      (window as any).Telegram?.WebApp?.enableClosingConfirmation();
      
      // Update back button
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        if (location.pathname !== '/') {
          tg.BackButton.show();
          tg.BackButton.onClick(() => window.history.back());
        } else {
          tg.BackButton.hide();
        }
      }
    } else {
      setLoading(false);
      setError("Please open via Telegram");
    }
  }, [location.pathname]);

  if (loading) return <div className="flex h-screen items-center justify-center text-primary"><div className="w-8 h-8 border-4 border-t-primary border-r-transparent rounded-full animate-spin"></div></div>;
  if (error) return <div className="flex h-screen flex-col items-center justify-center p-4 text-center"><h2 className="text-xl font-bold mb-2">Error</h2><p className="text-red-500">{error}</p></div>;

  const navItems = [
    { path: '/', icon: Home, label: 'Bosh' },
    { path: '/competitions', icon: List, label: 'Musobaqa' },
    { path: '/leaderboard', icon: Trophy, label: 'Reyting' },
    { path: '/profile', icon: UserIcon, label: 'Profil' },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] pb-16 bg-background text-foreground">
      <main className="flex-1 overflow-x-hidden p-4">
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/competitions" element={<CompetitionsPage user={user} />} />
          <Route path="/leaderboard" element={<LeaderboardPage user={user} />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 w-full bg-secondaryBg border-t border-primary/20 backdrop-blur-md">
        <ul className="flex justify-around items-center h-16 px-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <li key={path} className="flex-1">
                <Link to={path} className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-primary" : "text-hint hover:text-foreground"
                )}>
                  <Icon className={cn("w-6 h-6", isActive && "animate-bounce")} />
                  <span className="text-[10px] font-bold">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
