import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Snowflake, Palette, Square, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";

interface ShopItem {
  key: string;
  type: "theme" | "frame" | "streak_freeze";
  price: number;
  meta: Record<string, any>;
  owned: boolean;
}
interface ShopData {
  coins: number;
  streakFreezes: number;
  equippedThemeKey: string | null;
  equippedFrameKey: string | null;
  items: ShopItem[];
}

const TYPE_ICONS: Record<string, typeof Coins> = {
  theme: Palette,
  frame: Square,
  streak_freeze: Snowflake,
};

export default function ShopPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ShopData>({
    queryKey: ["/api/shop"],
    enabled: isAuthenticated,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/profile"),
    });
  };

  const buyMut = useMutation({
    mutationFn: async (key: string) => {
      const r = await apiRequest("POST", "/api/shop/buy", { key });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });
  const equipMut = useMutation({
    mutationFn: async (key: string) => {
      const r = await apiRequest("POST", "/api/shop/equip", { key });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">{t.leaderboard.shopTitle}</h1>
        <p className="text-muted-foreground">{t.leaderboard.leagueEmpty}</p>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-3xl space-y-6 animate-in fade-in duration-500">
      <SEO title={`${t.leaderboard.shopTitle} | YOZGO`} description={t.leaderboard.shopTitle} />

      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t.leaderboard.shopTitle}</h1>
        <div className="flex items-center gap-2 font-mono font-bold text-yellow-500" data-testid="text-coins">
          <Coins className="w-5 h-5" />
          {data.coins} {t.leaderboard.coinsLabel}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.items.map((it) => {
          const Icon = TYPE_ICONS[it.type] ?? Coins;
          const name = (t.leaderboard.cosmeticNames as Record<string, string>)[it.key] ?? it.key;
          const isEquipped =
            (it.type === "theme" && data.equippedThemeKey === it.key) ||
            (it.type === "frame" && data.equippedFrameKey === it.key);
          const canAfford = data.coins >= it.price;
          const busy = buyMut.isPending || equipMut.isPending;

          return (
            <Card key={it.key} className="bg-card border border-border" data-testid={`shop-${it.key}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  {it.type === "theme" && it.meta?.accent ? (
                    <span
                      className="w-5 h-5 rounded-full border border-border"
                      style={{ background: `hsl(${it.meta.accent})` }}
                    />
                  ) : (
                    <Icon className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Coins className="w-3 h-3" /> {it.price}
                    {it.type === "streak_freeze" && ` · ${data.streakFreezes}`}
                  </div>
                </div>
                {it.type === "streak_freeze" ? (
                  <Button size="sm" disabled={!canAfford || busy} onClick={() => buyMut.mutate(it.key)}>
                    {t.leaderboard.buy}
                  </Button>
                ) : isEquipped ? (
                  <span className="text-green-600 text-sm font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> {t.leaderboard.equipped}
                  </span>
                ) : it.owned ? (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => equipMut.mutate(it.key)}>
                    {t.leaderboard.equip}
                  </Button>
                ) : (
                  <Button size="sm" disabled={!canAfford || busy} onClick={() => buyMut.mutate(it.key)}>
                    {t.leaderboard.buy}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
