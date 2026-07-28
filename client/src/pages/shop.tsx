import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Snowflake, Palette, Square, Check, ShoppingBag } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { AuthGate } from "@/components/common/auth-gate";
import { QueryBoundary } from "@/components/common/query-boundary";
import { EmptyState } from "@/components/common/empty-state";
import { CardGridSkeleton } from "@/components/common/skeletons";

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

// Server sends an HSL triple like "25 95% 53%". Reject anything else rather
// than interpolate an arbitrary string into a style attribute.
const HSL_TRIPLE = /^\d{1,3} \d{1,3}% \d{1,3}%$/;

export default function ShopPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const query = useQuery<ShopData>({
    queryKey: ["/api/shop"],
    enabled: isAuthenticated,
  });
  const data = query.data;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/shop"] });
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/profile"),
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

  return (
    <PageShell
      size="md"
      icon={ShoppingBag}
      title={t.leaderboard.shopTitle}
      seo={{ title: t.leaderboard.shopTitle }}
      headerActions={
        data && (
          <Badge variant="soft-warning" data-testid="text-coins">
            <Coins className="h-3 w-3" aria-hidden="true" />
            {data.coins} {t.leaderboard.coinsLabel}
          </Badge>
        )
      }
    >
      <AuthGate title={t.leaderboard.shopTitle}>
        <QueryBoundary
          query={query}
          loading={<CardGridSkeleton count={4} />}
          isEmpty={!!data && data.items.length === 0}
          empty={<EmptyState icon={ShoppingBag} title={t.leaderboard.shopTitle} compact />}
        >
          {data && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.items.map((it) => {
                const Icon = TYPE_ICONS[it.type] ?? Coins;
                const name =
                  (t.leaderboard.cosmeticNames as Record<string, string>)[it.key] ?? it.key;
                const isEquipped =
                  (it.type === "theme" && data.equippedThemeKey === it.key) ||
                  (it.type === "frame" && data.equippedFrameKey === it.key);
                const canAfford = data.coins >= it.price;
                const busy = buyMut.isPending || equipMut.isPending;
                const swatch =
                  it.type === "theme" &&
                  typeof it.meta?.accent === "string" &&
                  HSL_TRIPLE.test(it.meta.accent)
                    ? it.meta.accent
                    : null;

                return (
                  <Card key={it.key} data-testid={`shop-${it.key}`}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        {swatch ? (
                          <span
                            className="h-5 w-5 rounded-full border border-border"
                            style={{ background: `hsl(${swatch})` }}
                            aria-hidden="true"
                          />
                        ) : (
                          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Coins className="h-3 w-3" aria-hidden="true" /> {it.price}
                          {it.type === "streak_freeze" && ` · ${data.streakFreezes}`}
                        </div>
                      </div>
                      {it.type === "streak_freeze" ? (
                        <Button
                          size="sm"
                          loading={busy}
                          disabled={!canAfford}
                          onClick={() => buyMut.mutate(it.key)}
                        >
                          {t.leaderboard.buy}
                        </Button>
                      ) : isEquipped ? (
                        <span className="flex items-center gap-1 text-sm font-bold text-success">
                          <Check className="h-4 w-4" aria-hidden="true" />{" "}
                          {t.leaderboard.equipped}
                        </span>
                      ) : it.owned ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy}
                          onClick={() => equipMut.mutate(it.key)}
                        >
                          {t.leaderboard.equip}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          loading={busy}
                          disabled={!canAfford}
                          onClick={() => buyMut.mutate(it.key)}
                        >
                          {t.leaderboard.buy}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </QueryBoundary>
      </AuthGate>
    </PageShell>
  );
}
