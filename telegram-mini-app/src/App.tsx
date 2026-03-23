import { useEffect, useState } from "react";
import { Trophy, Swords, Bell, User } from "lucide-react";
import Home from "./pages/Home";
import Competitions from "./pages/Competitions";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";

export const API_URL = import.meta.env.VITE_API_BASE_URL || "https://yozgo.uz/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.("bg_color");

      if (tg.initData) {
        fetch(`${API_URL}/auth/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Auth failed");
            return res.json();
          })
          .then((data) => {
            setUser(data.user);
            setLoading(false);
          })
          .catch((err) => {
            setError(err.message);
            setLoading(false);
          });
      } else {
        // Fallback for non-telegram
        setError("Faqat Telegram orqali kirish mumkin");
        setLoading(false);
      }

      const rb = tg.BackButton;
      if (activeTab !== "home") {
        rb.show();
        rb.onClick(() => setActiveTab("home"));
      } else {
        rb.hide();
      }
    } else {
      setError("Telegram Web App SDK topilmadi");
      setLoading(false);
    }
  }, [activeTab]);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-primary font-bold animate-pulse">
        Yuklanmoqda...
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col h-screen items-center justify-center p-4 text-center">
        <div className="text-red-500 mb-2">❌</div>
        <p className="font-medium">{error}</p>
      </div>
    );

  return (
    <div className="bg-background min-h-screen text-foreground pb-20">
      <main className="p-4">
        {activeTab === "home" && <Home user={user} />}
        {activeTab === "competitions" && <Competitions user={user} />}
        {activeTab === "notifications" && <Notifications user={user} />}
        {activeTab === "profile" && <Profile user={user} />}
      </main>

      <nav className="fixed bottom-0 w-full bg-secondaryBg/90 backdrop-blur-xl border-t border-hint/10 pb-safe z-50">
        <div className="flex justify-around items-center h-16">
          <NavBtn
            icon={Trophy}
            label="Asosiy"
            active={activeTab === "home"}
            onClick={() => setActiveTab("home")}
          />
          <NavBtn
            icon={Swords}
            label="Musobaqa"
            active={activeTab === "competitions"}
            onClick={() => setActiveTab("competitions")}
          />
          <NavBtn
            icon={Bell}
            label="Xabarlar"
            active={activeTab === "notifications"}
            onClick={() => setActiveTab("notifications")}
          />
          <NavBtn
            icon={User}
            label="Profil"
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
          />
        </div>
      </nav>
    </div>
  );
}

function NavBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${active ? "text-primary" : "text-hint hover:text-foreground"}`}
    >
      <Icon className={`w-5 h-5 ${active ? "fill-primary/20 scale-110" : ""}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {label === "Xabarlar" && !active && (
        <div className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}
