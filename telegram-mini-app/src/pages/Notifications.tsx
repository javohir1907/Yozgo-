import { useEffect, useState } from "react";
import { Bell, Calendar } from "lucide-react";
import { API_URL } from "../App";

export default function Notifications({ user }: { user: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/notifications`)
      .then((r) => r.json())
      .then(setNotifications)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6 pb-6">
      <h1 className="text-2xl font-black mb-6 flex items-center justify-between">
        Bildirishnomalar
        <Bell className="w-6 h-6 text-primary" />
      </h1>

      <div className="space-y-4">
        {notifications.map((notif, i) => (
          <div
            key={i}
            className="bg-secondaryBg rounded-2xl p-5 border border-hint/10 relative overflow-hidden"
          >
            {i === 0 && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg text-white">{notif.title}</h3>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold whitespace-nowrap">
                Yangi
              </span>
            </div>
            <p className="text-sm text-hint leading-relaxed whitespace-pre-wrap">{notif.message}</p>
            <div className="mt-3 text-[10px] text-hint/60 font-bold uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(notif.createdAt).toLocaleString("uz-UZ")}
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-20">
            <Bell className="w-16 h-16 text-hint/20 mx-auto mb-4" />
            <p className="text-hint font-medium">Hozircha xabarlar yo'q</p>
          </div>
        )}
      </div>
    </div>
  );
}
