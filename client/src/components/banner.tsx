import { ExternalLink, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface Ad {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
}

export function Banner({ ads }: { ads: Ad[] }) {
  if (!ads || ads.length === 0) return null;

  const trackClickMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/advertisements/${id}/click`);
    },
  });

  const handleLinkClick = (ad: Ad, e: React.MouseEvent<HTMLAnchorElement>) => {
    trackClickMutation.mutate(ad.id);
  };

  return (
    <div className="flex flex-col gap-4 items-center justify-center w-full px-4 mb-8">
      {ads.map((ad) => (
        <a
          key={ad.id}
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => handleLinkClick(ad, e)}
          className="group relative flex flex-col sm:flex-row items-center w-full max-w-4xl bg-[#151515] border border-orange-500/20 hover:border-orange-500/50 rounded-xl overflow-hidden transition-all duration-300 shadow-md hover:shadow-orange-500/10"
        >
          {/* Badge */}
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-orange-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-orange-500/20 flex items-center gap-1 z-10">
            <Info className="w-3 h-3" /> Reklama
          </div>

          <div className="w-full sm:w-1/3 aspect-[21/9] sm:aspect-auto sm:h-32 bg-[#0a0a0a] relative overflow-hidden flex-shrink-0">
            <img
              src={ad.imageUrl}
              alt={ad.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center text-left w-full h-full text-white">
            <h3 className="text-lg font-bold text-orange-500 group-hover:text-orange-400 transition-colors mb-1">
              {ad.title}
            </h3>
            {ad.description && (
              <p className="text-gray-400 text-sm line-clamp-1 mb-2">{ad.description}</p>
            )}

            <div className="mt-auto self-start flex items-center gap-1.5 text-orange-200/70 text-sm font-semibold group-hover:text-orange-200 transition-colors">
              Batafsil <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
