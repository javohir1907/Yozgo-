import { useEffect, useState } from 'react'
import { Calendar, Users, Target, ExternalLink } from 'lucide-react'
import { API_URL } from '../App'

export default function Home({ user }: { user: any }) {
  const [activeComp, setActiveComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/competitions`).then(r => r.json()),
      fetch(`${API_URL}/advertisements`).then(r => r.json())
    ])
    .then(([comps, adsRes]) => {
      if (comps && comps.length > 0) setActiveComp(comps[0]);
      if (adsRes && adsRes.length > 0) setAds(adsRes);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  const handleRegister = async () => {
    try {
      if (!user) return alert("Avval profilga kiring");
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.showConfirm(`${activeComp.title} ga ro'yxatdan o'tmoqchimisiz?`, async (confirmed: boolean) => {
          if (confirmed) {
            try {
              const r = await fetch(`${API_URL}/competitions/${activeComp.id}/register`, { method: "POST" });
              const resText = await r.json();
              if (!r.ok) {
                 tg.showAlert(resText.message || "Xatolik yuz berdi");
              } else {
                 tg.showAlert("Tabriklaymiz, muvaffaqiyatli ro'yxatdan o'tdingiz!");
                 setActiveComp((prev: any) => ({ ...prev, participantsCount: (prev.participantsCount || 0) + 1 }));
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
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-center py-4">
        <h1 className="text-3xl font-black text-white">YOZG<span className="text-primary">O</span></h1>
      </div>

      <div className="space-y-3">
        {activeComp ? (
          <div className="bg-secondaryBg rounded-3xl p-6 border border-hint/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            
            <div className="flex items-center gap-2 mb-4">
               <span className="animate-pulse w-2 h-2 rounded-full bg-primary" />
               <span className="text-primary text-xs font-bold uppercase tracking-wider">Aktiv Musobaqa</span>
            </div>

            <h2 className="text-2xl font-black text-white mb-2 leading-tight">{activeComp.title}</h2>
            
            <div className="space-y-2 mb-6">
               <div className="flex items-center gap-2 text-sm text-hint">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(activeComp.date).toLocaleString('uz-UZ')}</span>
               </div>
               <div className="flex items-center gap-2 text-sm text-hint">
                  <Target className="w-4 h-4 text-orange-400" />
                  <span className="font-bold text-orange-400">{activeComp.prize}</span>
               </div>
               <div className="flex items-center gap-2 text-sm text-hint">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>{activeComp.participantsCount || 0} ishtirokchi</span>
               </div>
            </div>

            <button 
              onClick={handleRegister}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
            >
              Ro'yxatdan o'tish
            </button>
          </div>
        ) : (
          <div className="bg-secondaryBg rounded-3xl p-8 text-center border border-hint/10">
            <div className="w-16 h-16 bg-hint/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-hint/50" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Hozircha musobaqa yo'q</h3>
            <p className="text-hint text-sm">Yangi musobaqalar haqida tez orada e'lon beramiz. Kuzatib boring!</p>
          </div>
        )}

        {ads.length > 0 && (
          <div className="mt-8 space-y-4">
             {ads.map((ad, idx) => (
                <a 
                  key={idx} 
                  href={ad.linkUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block bg-secondaryBg rounded-2xl overflow-hidden border border-hint/5 active:scale-[0.98] transition-transform"
                >
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-32 object-cover" />
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-white text-sm">{ad.title}</h4>
                      <p className="text-xs text-hint line-clamp-1">{ad.description || 'Homiylarimizga tashrif buyuring'}</p>
                    </div>
                    <div className="bg-primary/10 text-primary p-2 rounded-lg">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </a>
             ))}
          </div>
        )}
      </div>
    </div>
  )
}
