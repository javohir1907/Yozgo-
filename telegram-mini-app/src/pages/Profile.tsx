import { useEffect, useState } from 'react'
import { API_URL } from '../App'
import { Trophy, Clock, Zap, Target } from 'lucide-react'

export default function Profile({ user }: { user: any }) {
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if(user?.id) fetch(`${API_URL}/profile/${user.id}`).then(r => r.json()).then(setProfileData).catch(console.error);
  }, [user]);

  if (!profileData) return <div className="text-center py-20 text-hint text-sm animate-pulse font-medium">Yuklanmoqda...</div>;

  const { stats } = profileData;

  const badges = [
    { title: "Birinchi test", icon: Trophy, active: stats.totalTests > 0 },
    { title: "Yashin tezligi (>50 WPM)", icon: Zap, active: stats.bestWpm > 50 },
    { title: "Ustasi farang (>100 WPM)", icon: Crown, active: stats.bestWpm > 100 },
    { title: "Aniqlik (>90%)", icon: Target, active: stats.avgAccuracy > 90 },
  ];

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex flex-col items-center justify-center p-6 bg-secondaryBg border border-primary/20 rounded-[2rem] shadow-xl shadow-primary/5">
         <div className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-br from-primary to-orange-400 mb-4">
           <img 
              src={user?.profileImageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user?.id} 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover border-4 border-background"
           />
         </div>
         <h1 className="text-2xl font-black">{profileData.user.username}</h1>
         <p className="text-sm font-medium text-hint uppercase tracking-widest mt-1">Tajribali Ishtirokchi</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-secondaryBg p-4 rounded-3xl border border-hint/10 flex flex-col justify-center">
            <span className="text-[10px] text-hint uppercase font-bold tracking-[0.2em] mb-1">Rekord tezlik</span>
            <div className="flex items-baseline gap-1.5">
               <span className="text-4xl font-black font-mono text-primary italic">{stats.bestWpm}</span>
               <span className="text-xs font-bold text-hint">WPM</span>
            </div>
         </div>
         
         <div className="bg-secondaryBg p-4 rounded-3xl border border-hint/10 flex flex-col justify-center">
            <span className="text-[10px] text-hint uppercase font-bold tracking-[0.2em] mb-1">Ajoyib aniqlik</span>
            <div className="flex items-baseline gap-1.5">
               <span className="text-4xl font-black font-mono text-orange-400 italic">{stats.avgAccuracy}</span>
               <span className="text-xs font-bold text-hint">% ACC</span>
            </div>
         </div>
      </div>

      {/* Other stats */}
      <div className="bg-secondaryBg p-5 rounded-3xl border border-hint/10 space-y-4">
         <div className="flex items-center justify-between border-b border-hint/10 pb-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Clock className="w-5 h-5" /></div>
                <div>
                   <h3 className="font-bold text-sm">O'tkazilgan musobaqalar</h3>
                   <p className="text-xs text-hint">Jami ishtiroklar soni</p>
                </div>
             </div>
             <span className="text-2xl font-black">{stats.totalTests}</span>
         </div>
         
         <div className="flex items-center justify-between pt-2">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-400/10 flex items-center justify-center text-orange-400"><Target className="w-5 h-5" /></div>
                <div>
                   <h3 className="font-bold text-sm">O'rtacha natija</h3>
                   <p className="text-xs text-hint">Kundalik o'rtacha</p>
                </div>
             </div>
             <span className="text-2xl font-black">{stats.avgWpm}</span>
         </div>
      </div>

      {/* Badges/Yutuqlar */}
      <div>
         <h2 className="text-lg font-black mb-4 uppercase tracking-widest text-primary italic px-2 flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Yutuqlar</h2>
         <div className="grid grid-cols-2 gap-3">
             {badges.map((badge, idx) => (
                <div key={idx} className={`p-4 flex flex-col items-center justify-center text-center rounded-2xl border ${badge.active ? 'bg-primary/5 border-primary text-primary' : 'bg-secondaryBg border-hint/10 text-hint opacity-50 grayscale'}`}>
                   <badge.icon className="w-8 h-8 mb-2" />
                   <span className="text-xs font-bold uppercase tracking-wider">{badge.title}</span>
                </div>
             ))}
         </div>
      </div>
    </div>
  )
}

function Crown(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" {...props}><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.956-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>
}
