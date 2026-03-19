import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Clock, Medal } from 'lucide-react'
import { API_URL } from '../App'

export default function Home({ user }: { user: any }) {
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_URL}/competitions`).then(r => r.json()).then(setCompetitions).catch(console.error);
    if(user?.id) fetch(`${API_URL}/profile/${user.id}`).then(r => r.json()).then(d => setStats(d.stats)).catch(console.error);
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary/20 rounded border border-primary text-primary flex items-center justify-center font-black text-xl">
            Y
          </div>
          <h1 className="text-2xl font-black italic tracking-wider">YOZGO</h1>
        </div>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-hint/30">
          <img src={user?.profileImageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user?.id} alt="Avatar" className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="bg-gradient-to-br from-secondaryBg to-background p-5 rounded-2xl border border-primary/20 shadow-lg shadow-primary/5">
        <h2 className="text-hint text-sm font-semibold mb-1">Mening Reytingim</h2>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-4xl font-black text-primary">{stats?.bestWpm || 0}</span>
            <span className="text-sm text-hint ml-1 ml-1">WPM</span>
          </div>
          <div className="flex gap-4">
             <div className="text-right">
               <div className="text-xs text-hint uppercase font-bold">Aniqlik</div>
               <div className="font-mono font-bold">{stats?.avgAccuracy || 0}%</div>
             </div>
             <div className="text-right">
               <div className="text-xs text-hint uppercase font-bold">Testlar</div>
               <div className="font-mono font-bold">{stats?.totalTests || 0}</div>
             </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Aktiv Musobaqalar</h2>
          <Link to="/competitions" className="text-xs text-primary font-bold uppercase hover:underline">Barchasi</Link>
        </div>
        
        <div className="space-y-4">
          {competitions.slice(0, 3).map(comp => (
            <div key={comp.id} className="bg-secondaryBg p-4 rounded-xl border border-hint/10">
              <h3 className="font-bold text-lg mb-2">{comp.title}</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-hint mb-4">
                 <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(comp.date).toLocaleDateString()}</span>
                 {comp.prize && <span className="flex items-center gap-1 text-yellow-500"><Medal className="w-3.5 h-3.5" /> {comp.prize}</span>}
              </div>
              <button 
                onClick={() => (window as any).Telegram?.WebApp?.openLink("https://yozgo.uz/battle")}
                className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-lg border border-primary/30 transition-colors"
               >
                Ishtirok etish
              </button>
            </div>
          ))}
          {competitions.length === 0 && (
             <p className="text-center text-hint text-sm py-4">Ayni vaqtda faol musobaqalar yo'q.</p>
          )}
        </div>
      </div>
    </div>
  )
}
