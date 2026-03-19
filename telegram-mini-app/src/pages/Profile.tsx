import { useEffect, useState } from 'react'
import { API_URL } from '../App'
import { Trophy, Clock, Zap, Target } from 'lucide-react'

export default function Profile({ user }: { user: any }) {
  const [profileData, setProfileData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      fetch(`${API_URL}/profile/${user.id}`)
        .then(r => r.json())
        .then(setProfileData)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [user])

  if (loading) return null

  // Telegramdan olgan malumotlarni moslash
  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const avatar = user?.profileImageUrl || tgUser?.photo_url || `https://ui-avatars.com/api/?name=${user?.firstName || 'M'}&background=random`
  const joinDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('uz-UZ') : ''
  const maxWpm = profileData?.stats?.maxWpm || 0
  const compsParticipated = profileData?.competitionsCount || 0

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="relative">
           <img 
             src={avatar} 
             alt="Profile" 
             className="w-24 h-24 rounded-full object-cover border-4 border-secondaryBg shadow-xl"
           />
           {maxWpm > 80 && (
             <div className="absolute -bottom-2 -right-2 bg-primary w-8 h-8 rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                <Trophy className="w-4 h-4 text-white" />
             </div>
           )}
        </div>
        
        <h2 className="text-2xl font-black text-white mt-4">{user?.firstName || tgUser?.first_name || 'Nomsiz Oylinchi'}</h2>
        <p className="text-hint text-sm font-medium mt-1">Siz biz bilan {joinDate} dan beri birgasiz</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-secondaryBg rounded-3xl p-5 border border-hint/10">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-black text-white">{maxWpm} <span className="text-sm text-hint uppercase font-bold tracking-wider">WPM</span></div>
          <p className="text-xs text-hint mt-1 font-medium">Rekord tezlik</p>
        </div>

        <div className="bg-secondaryBg rounded-3xl p-5 border border-hint/10">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-white">{compsParticipated} <span className="text-sm text-hint uppercase font-bold tracking-wider">ta</span></div>
          <p className="text-xs text-hint mt-1 font-medium">Ishtiroklar soni</p>
        </div>
      </div>
    </div>
  )
}
