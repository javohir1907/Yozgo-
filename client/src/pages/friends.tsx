import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Check } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { AuthGate } from "@/components/common/auth-gate";
import { QueryBoundary } from "@/components/common/query-boundary";
import { UserRow, type UserRowUser } from "@/components/common/user-row";
import { SectionLabel } from "@/components/common/section-label";
import { EmptyState } from "@/components/common/empty-state";
import { ListSkeleton } from "@/components/common/skeletons";

interface FriendUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  frameMeta?: { ring?: string } | null;
}
interface FriendsData {
  friends: FriendUser[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
}

export default function FriendsPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [newId, setNewId] = useState("");

  const query = useQuery<FriendsData>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/friends"] });

  const addMut = useMutation({
    mutationFn: async (addresseeId: string) => {
      const r = await apiRequest("POST", "/api/friends/request", { addresseeId });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      setNewId("");
      invalidate();
    },
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });
  const acceptMut = useMutation({
    mutationFn: async (requesterId: string) => {
      const r = await apiRequest("POST", "/api/friends/accept", { requesterId });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ variant: "destructive", title: e.message }),
  });

  const toRow = (u: FriendUser): UserRowUser => ({
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    frameMeta: u.frameMeta,
  });

  return (
    <PageShell
      size="sm"
      icon={Users}
      title={t.leaderboard.friendsTitle}
      seo={{ title: t.leaderboard.friendsTitle }}
    >
      <AuthGate title={t.leaderboard.friendsTitle}>
        <div className="flex gap-2">
          <Input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder={t.leaderboard.addFriendPlaceholder}
            aria-label={t.leaderboard.addFriendPlaceholder}
            className="flex-1"
          />
          <Button
            loading={addMut.isPending}
            disabled={!newId}
            onClick={() => addMut.mutate(newId.trim())}
          >
            <UserPlus aria-hidden="true" /> {t.leaderboard.sendRequest}
          </Button>
        </div>

        <QueryBoundary query={query} loading={<ListSkeleton rows={4} />}>
          {query.data && (
            <div className="space-y-6">
              {query.data.incoming.length > 0 && (
                <section className="space-y-2">
                  <SectionLabel>{t.leaderboard.incomingLabel}</SectionLabel>
                  <Card>
                    <CardContent className="divide-y divide-border/50 p-0">
                      {query.data.incoming.map((u) => (
                        <UserRow
                          key={u.id}
                          user={toRow(u)}
                          size="sm"
                          trailing={
                            <Button
                              size="sm"
                              loading={acceptMut.isPending}
                              onClick={() => acceptMut.mutate(u.id)}
                            >
                              <Check aria-hidden="true" /> {t.leaderboard.acceptFriend}
                            </Button>
                          }
                        />
                      ))}
                    </CardContent>
                  </Card>
                </section>
              )}

              <section className="space-y-2">
                <SectionLabel>{t.leaderboard.myFriends}</SectionLabel>
                {query.data.friends.length === 0 ? (
                  <EmptyState icon={Users} title={t.leaderboard.noFriends} compact />
                ) : (
                  <Card>
                    <CardContent className="divide-y divide-border/50 p-0">
                      {query.data.friends.map((u) => (
                        <UserRow key={u.id} user={toRow(u)} size="sm" />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </section>

              {query.data.outgoing.length > 0 && (
                <section className="space-y-2">
                  <SectionLabel>{t.leaderboard.outgoingLabel}</SectionLabel>
                  <Card>
                    <CardContent className="divide-y divide-border/50 p-0">
                      {query.data.outgoing.map((u) => (
                        <UserRow
                          key={u.id}
                          user={toRow(u)}
                          size="sm"
                          trailing={
                            <span className="text-xs text-muted-foreground">
                              {t.leaderboard.pendingShort}
                            </span>
                          }
                        />
                      ))}
                    </CardContent>
                  </Card>
                </section>
              )}
            </div>
          )}
        </QueryBoundary>
      </AuthGate>
    </PageShell>
  );
}
