import { useEffect, useState } from 'react'
import { API_URL } from '../App'
import { Trophy, Clock, Medal, Users } from 'lucide-react'

export default function Competitions({ user }: { user: any }) {
  const [competitions, setCompetitions] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all')

  useEffect(() => {
    fetch(`${API_URL}/competitions/all`)
      .then(r => r.json())
      .then(setCompetitions)
      .catch(console.error);
  }, [user]);

  const filtered = competitions.filter(comp => {
    if(filter === 'active') return comp.isActive;
    if(filter === 'finished') return !comp.isActive;
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black mb-6">Musobaqalar</h1>
      
      <div className="flex bg-secondaryBg p-1 rounded-xl border border-hint/10">
        <button 
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === 'all' ? 'bg-primary text-white shadow-md' : 'text-hint'}`}
        >Barchasi</button>
        <button 
          onClick={() => setFilter('active')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === 'active' ? 'bg-green-500 text-white shadow-md' : 'text-hint'}`}
        >Faol</button>
        <button 
          onClick={() => setFilter('finished')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${filter === 'finished' ? 'bg-red-500 text-white shadow-md' : 'text-hint'}`}
        >Tugagan</button>
      </div>

      <div className="space-y-4">
        {filtered.map(comp => (
          <div key={comp.id} className={`p-4 rounded-xl border ${comp.isActive ? "border-primary/30 bg-primary/5" : "border-hint/10 bg-secondaryBg"}`}>
            <div className="flex justify-between items-start mb-2">
               <h3 className="font-bold text-lg">{comp.title}</h3>
               {comp.isActive ? (
                 <span className="bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0">Aktiv</span>
               ) : (
                 <span className="bg-red-500/10 text-red-500 text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0">Tugagan</span>
               )}
            </div>
            
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-medium text-hint mb-4">
               <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(comp.date).toLocaleDateString()}</div>
               <div className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {comp.participantsCount || 0} Ishtirokchi</div>
               {comp.prize && <div className="flex items-center gap-1 text-yellow-500 col-span-2"><Medal className="w-3.5 h-3.5" /> Sovrin: {comp.prize}</div>}
               {comp.winnerName && <div className="flex items-center gap-1 text-primary col-span-2"><Trophy className="w-3.5 h-3.5" /> G'olib: {comp.winnerName}</div>}
            </div>
            
            {comp.isActive && (
              <button 
                onClick={() => {
                  const tg = (window as any).Telegram?.WebApp;
                  if (tg?.showConfirm) {
                    tg.showConfirm(`Siz rostdan ham '${comp.title}' musobaqasiga ro'yxatdan o'tmoqchimisiz?`, (confirmed: boolean) => {
                       if (confirmed) {
                         tg.showAlert("Tabriklaymiz, siz muvaffaqiyatli ro'yxatdan o'tdingiz!");
                       }
                    });
                  } else {
                     alert("Siz ro'yxatdan o'tdingiz!");
                  }
                }}
                className="w-full py-2 bg-primary hover:bg-orange-600 text-white font-bold rounded-lg transition-colors tracking-wide"
              >
                Ro'yxatdan o'tish
              </button>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-10 text-hint">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">Musobaqalar topilmadi</p>
          </div>
        )}
      </div>
    </div>
  )
}
