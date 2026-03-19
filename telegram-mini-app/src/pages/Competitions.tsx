import { useEffect, useState } from 'react'
import { API_URL } from '../App'
import { Trophy, Clock, Target, Users } from 'lucide-react'

export default function Competitions({ user }: { user: any }) {
  const [competitions, setCompetitions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/competitions/all`)
      .then(r => r.json())
      .then(setCompetitions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleRegister = async (comp: any) => {
    try {
      if (!user) return alert("Avval profilga kiring");
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.showConfirm(`${comp.title} ga ro'yxatdan o'tmoqchimisiz?`, async (confirmed: boolean) => {
          if (confirmed) {
            try {
              const r = await fetch(`${API_URL}/competitions/${comp.id}/register`, { method: "POST" });
              const resText = await r.json();
              if (!r.ok) {
                 tg.showAlert(resText.message || "Xatolik yuz berdi");
              } else {
                 tg.showAlert("Tabriklaymiz, muvaffaqiyatli ro'yxatdan o'tdingiz!");
                 setCompetitions(prev => prev.map(c => c.id === comp.id ? { ...c, participantsCount: (c.participantsCount || 0) + 1 } : c));
              }
            } catch(e) {
              tg.showAlert("Server bilan ulanishda xato");
            }
          }
        });
      }
    } catch(e) {
      alert("Xatolik");
    }
  }

  if (loading) return null

  return (
    <div className="space-y-6 pb-6">
      <h1 className="text-2xl font-black mb-6 flex items-center gap-3">
         Musobaqalar 
         <Trophy className="w-6 h-6 text-primary" />
      </h1>

      <div className="space-y-4">
        {competitions.map((comp) => {
          const now = new Date()
          const compDate = new Date(comp.date)
          let status = "aktiv"
          let statusColor = "bg-green-500/10 text-green-500 text-green-500"
          
          if (!comp.isActive) {
            status = "tugagan"
            statusColor = "bg-red-500/10 text-red-500"
          } else if (compDate > now) {
            status = "kutilmoqda"
            statusColor = "bg-blue-500/10 text-blue-500"
          }

          return (
            <div key={comp.id} className="bg-secondaryBg rounded-2xl p-5 border border-hint/10">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-white pr-4 leading-tight">{comp.title}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${statusColor}`}>
                  {status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-y-3 mb-5">
                <div className="flex items-center gap-2 text-sm text-hint">
                  <Clock className="w-4 h-4" />
                  {compDate.toLocaleString('uz-UZ').split(',')[0]}
                </div>
                <div className="flex items-center gap-2 text-sm text-orange-400 font-bold justify-self-end">
                  <Target className="w-4 h-4" />
                  {comp.prize}
                </div>
                <div className="flex items-center gap-2 text-sm text-hint col-span-2">
                  <Users className="w-4 h-4" />
                  {comp.participantsCount || 0} ta o'yinchi ro'yxatdan o'tdi
                </div>
              </div>

              {(status === 'aktiv' || status === 'kutilmoqda') ? (
                 <button 
                    onClick={() => handleRegister(comp)}
                    className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-white transition-colors py-2.5 rounded-xl font-bold text-sm"
                 >
                    Ro'yxatdan o'tish
                 </button>
              ) : (
                 <button disabled className="w-full bg-hint/5 text-hint/50 py-2.5 rounded-xl font-bold text-sm">
                    Tugallangan
                 </button>
              )}
            </div>
          )
        })}

        {competitions.length === 0 && (
          <div className="text-center py-20">
             <Trophy className="w-16 h-16 text-hint/20 mx-auto mb-4" />
             <p className="text-hint font-medium">Hech qanday musobaqa topilmadi</p>
          </div>
        )}
      </div>
    </div>
  )
}
