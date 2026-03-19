import { useEffect, useState } from 'react'
import { Trophy, Medal, Crown } from 'lucide-react'
import { API_URL } from '../App'

export default function Leaderboard({ user }: { user: any }) {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/leaderboard?period=alltime&language=uz`)
      .then(r => r.json())
      .then(setLeaders)
      .catch(console.error);
  }, [user]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
    if (rank === 2) return 'bg-gray-300/10 text-gray-300 border-gray-300/30'
    if (rank === 3) return 'bg-amber-700/10 text-amber-700 border-amber-700/30'
    return 'bg-secondaryBg border-hint/10'
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col items-center justify-center text-center mt-4">
        <Trophy className="w-16 h-16 text-primary mb-2 drop-shadow-lg" />
        <h1 className="text-2xl font-black uppercase tracking-widest italic">Reyting</h1>
        <p className="text-hint text-sm font-medium">Barcha vaqtlardagi eng yaxshi ishtirokchilar</p>
      </div>

      <div className="space-y-3">
        {leaders.map((leader, i) => {
           const isMe = user?.username === leader.username || user?.firstName === leader.username || user?.email?.split('@')[0] === leader.username
           return (
            <div 
              key={i} 
              className={`flex items-center gap-4 p-4 rounded-2xl border ${isMe ? 'border-primary/50 shadow-[0_0_15px_rgba(249,115,22,0.1)] bg-primary/5 scale-[1.02]' : getRankColor(leader.rank)} transition-transform relative overflow-hidden`}
            >
              {isMe && <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>}
              
              <div className="flex items-center justify-center w-10 h-10 font-black text-xl shrink-0">
                {leader.rank === 1 ? <Crown className="w-8 h-8 text-yellow-500" /> : 
                 leader.rank === 2 ? <Medal className="w-8 h-8 text-gray-300" /> :
                 leader.rank === 3 ? <Medal className="w-8 h-8 text-amber-700" /> : `#${leader.rank}`}
              </div>
              
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 bg-background shrink-0">
                <img src={leader.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + leader.username} alt="User" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base truncate flex items-center gap-2">
                  {leader.username}
                  {isMe && <span className="text-[9px] bg-primary text-white uppercase px-1.5 py-0.5 rounded-sm">Men</span>}
                </h3>
                <p className="text-xs text-hint uppercase tracking-wider font-semibold">{leader.language} tili</p>
              </div>
              
              <div className="text-right shrink-0">
                <div className="text-2xl font-black font-mono text-primary italic">{leader.wpm}</div>
                <div className="text-[10px] text-hint uppercase font-bold tracking-widest leading-none">WPM</div>
              </div>
            </div>
           )
        })}

        {leaders.length === 0 && (
           <p className="text-center py-10 text-hint text-sm font-medium">Ro'yxat bo'sh...</p>
        )}
      </div>
    </div>
  )
}
