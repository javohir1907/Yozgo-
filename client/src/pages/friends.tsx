import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserPlus, Check, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";

interface FriendUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}
interface FriendsData {
  friends: FriendUser[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
}

function Row({ u, action }: { u: FriendUser; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
      <Avatar className="h-8 w-8">
        <AvatarImage src={u.avatarUrl ?? undefined} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary">
          {u.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 font-medium truncate">{u.username}</span>
      {action}
    </div>
  );
}

export default function FriendsPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [newId, setNewId] = useState("");

  const { data, isLoading } = useQuery<FriendsData>({
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

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">{t.leaderboard.friendsTitle}</h1>
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
    <div className="container mx-auto p-4 sm:p-8 max-w-2xl space-y-6 animate-in fade-in duration-500">
      <SEO title={`${t.leaderboard.friendsTitle} | YOZGO`} description={t.leaderboard.friendsTitle} />

      <header className="flex items-center gap-3">
        <Users className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">{t.leaderboard.friendsTitle}</h1>
      </header>

      <div className="flex gap-2">
        <Input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder={t.leaderboard.addFriendPlaceholder}
          className="flex-1"
        />
        <Button disabled={!newId || addMut.isPending} onClick={() => addMut.mutate(newId.trim())}>
          <UserPlus className="w-4 h-4 mr-1" /> {t.leaderboard.sendRequest}
        </Button>
      </div>

      {data.incoming.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {t.leaderboard.incomingLabel}
          </h2>
          <Card className="border border-border">
            <CardContent className="p-0">
              {data.incoming.map((u) => (
                <Row
                  key={u.id}
                  u={u}
                  action={
                    <Button size="sm" disabled={acceptMut.isPending} onClick={() => acceptMut.mutate(u.id)}>
                      <Check className="w-4 h-4 mr-1" /> {t.leaderboard.acceptFriend}
                    </Button>
                  }
                />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {t.leaderboard.myFriends}
        </h2>
        <Card className="border border-border">
          <CardContent className="p-0">
            {data.friends.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">{t.leaderboard.noFriends}</div>
            ) : (
              data.friends.map((u) => <Row key={u.id} u={u} />)
            )}
          </CardContent>
        </Card>
      </section>

      {data.outgoing.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {t.leaderboard.outgoingLabel}
          </h2>
          <Card className="border border-border">
            <CardContent className="p-0">
              {data.outgoing.map((u) => (
                <Row key={u.id} u={u} action={<span className="text-xs text-muted-foreground">…</span>} />
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
