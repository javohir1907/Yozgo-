import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle,
  DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import {
  Users, Trophy, KeyRound, Settings as SettingsIcon, BarChart3,
  Ban, ShieldCheck, Trash2, Download, Loader2, RefreshCw, Megaphone,
  AlertTriangle, Shield, Swords, ScrollText, Coins, Star, Award, Gift,
} from "lucide-react";

/**
 * YOZGO — Admin boshqaruv paneli (React).
 * Mavjud /api/admin/* endpointlaridan foydalanadi. Faqat role='admin' ko'ra oladi:
 * client-side Redirect gate + server tomonda adminAuth/adminGuard session-admin tekshiruvi.
 */
export default function AdminPage() {
  const { user, isLoading } = useAuth();

  // ---- Ruxsat tekshiruvi (client-side gate) ----
  // isLoading paytida spinner. Login yo'q -> /auth. Admin emas -> home.
  // Redirect null render qiladi: admin UI zarrasi ham DOM'ga chiqmaydi.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Redirect to="/auth" />;
  if ((user as any).role !== "admin") return <Redirect to="/" />;

  return (
    <div className="container max-w-5xl py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/10">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">Admin panel</h1>
          <p className="text-sm text-muted-foreground">
            {(user as any).firstName || (user as any).email} — boshqaruv
          </p>
        </div>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Statistika</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Foydalanuvchilar</TabsTrigger>
          <TabsTrigger value="comps" className="gap-1.5"><Trophy className="w-4 h-4" /> Musobaqalar</TabsTrigger>
          <TabsTrigger value="codes" className="gap-1.5"><KeyRound className="w-4 h-4" /> Kodlar</TabsTrigger>
          <TabsTrigger value="leagues" className="gap-1.5"><Shield className="w-4 h-4" /> Ligalar</TabsTrigger>
          <TabsTrigger value="battles" className="gap-1.5"><Swords className="w-4 h-4" /> Janglar</TabsTrigger>
          <TabsTrigger value="broadcast" className="gap-1.5"><Megaphone className="w-4 h-4" /> Xabar</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="w-4 h-4" /> Audit</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><SettingsIcon className="w-4 h-4" /> Sozlamalar</TabsTrigger>
        </TabsList>

        <TabsContent value="stats"><StatsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="comps"><CompetitionsTab /></TabsContent>
        <TabsContent value="codes"><CodesTab currentUserId={(user as any).id} /></TabsContent>
        <TabsContent value="leagues"><LeaguesTab /></TabsContent>
        <TabsContent value="battles"><BattlesTab /></TabsContent>
        <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ UMUMIY HOLAT KOMPONENTLARI ============
function Spinner() {
  return <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
}
function ErrorBox({ error }: { error: any }) {
  return (
    <div className="py-6 flex flex-col items-center gap-2 text-center">
      <AlertTriangle className="w-6 h-6 text-destructive" />
      <p className="text-sm text-destructive font-medium">Yuklashda xatolik</p>
      <p className="text-xs text-muted-foreground">{error?.message || "Noma'lum xato"}</p>
    </div>
  );
}
function EmptyBox({ text }: { text: string }) {
  return <p className="text-muted-foreground text-center py-6">{text}</p>;
}

// Buzuvchi amal uchun tasdiqlash dialogi (Radix Dialog).
function ConfirmButton({
  triggerLabel, triggerIcon, triggerVariant = "destructive", title, description,
  confirmLabel = "Tasdiqlash", onConfirm, size = "sm",
}: {
  triggerLabel: React.ReactNode; triggerIcon?: React.ReactNode;
  triggerVariant?: any; title: string; description: string;
  confirmLabel?: string; onConfirm: () => void | Promise<void>; size?: any;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size={size} variant={triggerVariant} className="gap-1.5" onClick={() => setOpen(true)}>
        {triggerIcon}{triggerLabel}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Bekor</Button></DialogClose>
          <Button variant="destructive" onClick={async () => { await onConfirm(); setOpen(false); }}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ STATISTIKA ============
function StatsTab() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  return (
    <div className="space-y-4">
      {isError ? <ErrorBox error={error} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Jami foydalanuvchilar" value={data?.totalUsers} loading={isLoading} icon={<Users className="w-5 h-5" />} />
          <StatCard label="Bugun faol" value={data?.activeToday} loading={isLoading} icon={<BarChart3 className="w-5 h-5" />} />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Yangilash
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5"
          onClick={() => window.open("/api/admin/users/export", "_blank")}>
          <Download className="w-4 h-4" /> Userlarni CSV export
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, icon }: { label: string; value: any; loading: boolean; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-extrabold text-primary">
              {loading ? "…" : (value ?? "—")}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ FOYDALANUVCHILAR ============
function UsersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  const key = query ? ["/api/admin/users/search", query] : ["/api/admin/users/top"];
  const { data: usersList, isLoading, isError, error } = useQuery<any[]>({ queryKey: key });
  const [detailId, setDetailId] = useState<string | null>(null);

  async function toggleBan(u: any) {
    try {
      await apiRequest("POST", `/api/admin/users/${u.id}/toggle-ban`);
      toast({ title: u.isBanned ? "Blokdan chiqarildi" : "Bloklandi", description: u.firstName || u.email });
      qc.invalidateQueries({ queryKey: key });
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Foydalanuvchilar</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(term.trim()); }}>
          <Input placeholder="Nickname, email yoki ID bo'yicha qidiruv…" value={term} onChange={(e) => setTerm(e.target.value)} />
          <Button type="submit">Qidirish</Button>
          {query && <Button type="button" variant="ghost" onClick={() => { setTerm(""); setQuery(""); }}>Tozalash</Button>}
        </form>
        <p className="text-xs text-muted-foreground">{query ? `"${query}" natijalari` : "Oxirgi foydalanuvchilar (top 10)"}</p>

        {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nickname</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="text-right">Amal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usersList || []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <button className="font-medium text-left hover:text-primary hover:underline" onClick={() => setDetailId(u.id)}>
                        {u.firstName || "—"}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                    <TableCell><Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
                    <TableCell>
                      {u.isBanned
                        ? <Badge variant="destructive">Bloklangan</Badge>
                        : <Badge variant="outline" className="text-green-600 border-green-600">Aktiv</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.isBanned ? (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toggleBan(u)}>
                          <ShieldCheck className="w-3.5 h-3.5" /> Chiqarish
                        </Button>
                      ) : (
                        <ConfirmButton
                          triggerLabel="Bloklash"
                          triggerIcon={<Ban className="w-3.5 h-3.5" />}
                          title="Foydalanuvchini bloklash"
                          description={`"${u.firstName || u.email}" bloklanadi. Davom etasizmi?`}
                          confirmLabel="Bloklash"
                          onConfirm={() => toggleBan(u)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (usersList || []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Topilmadi</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {detailId && (
          <UserDetailDialog
            userId={detailId}
            onClose={() => { setDetailId(null); qc.invalidateQueries({ queryKey: key }); }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ============ USER DETAIL + TAHRIR + GRANT (modal) ============
function UserDetailDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const detailKey = ["/api/admin/users", userId, "detail"];
  const { data: d, isLoading, isError, error } = useQuery<any>({ queryKey: detailKey });
  const { data: badgeCatalog } = useQuery<any[]>({ queryKey: ["/api/admin/badges"] });

  const [xp, setXp] = useState("");
  const [coins, setCoins] = useState("");
  const [grantType, setGrantType] = useState<"coins" | "xp" | "badge">("coins");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantBadgeId, setGrantBadgeId] = useState("");
  const [reason, setReason] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: detailKey });
    setXp(""); setCoins("");
  };

  async function saveEdit() {
    const body: any = {};
    if (xp.trim() !== "") body.xp = Number(xp);
    if (coins.trim() !== "") body.coins = Number(coins);
    if (Object.keys(body).length === 0) { toast({ title: "Bo'sh", description: "xp yoki coins kiriting" }); return; }
    try {
      await apiRequest("PATCH", `/api/admin/users/${userId}`, body);
      toast({ title: "Saqlandi", description: `${d?.firstName || d?.email}` });
      refresh();
    } catch (e: any) { toast({ title: "Xatolik", description: e.message, variant: "destructive" }); }
  }

  async function doGrant() {
    const body: any = { type: grantType, reason };
    if (grantType === "badge") { if (!grantBadgeId) { toast({ title: "Badge tanlang" }); return; } body.badgeId = grantBadgeId; }
    else { const a = Number(grantAmount); if (!a || a <= 0) { toast({ title: "amount > 0" }); return; } body.amount = a; }
    try {
      await apiRequest("POST", `/api/admin/users/${userId}/grant`, body);
      toast({ title: "Berildi", description: `${grantType} ${grantType === "badge" ? "" : grantAmount}` });
      setGrantAmount(""); setReason("");
      refresh();
    } catch (e: any) { toast({ title: "Xatolik", description: e.message, variant: "destructive" }); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d?.firstName || d?.email || "Foydalanuvchi"}</DialogTitle>
          <DialogDescription>{d?.email} · {d?.role}{d?.isBanned ? " · BLOKLANGAN" : ""}</DialogDescription>
        </DialogHeader>

        {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} /> : d && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-4 gap-2">
              <Stat label="XP" value={d.xp} />
              <Stat label="Level" value={d.level} />
              <Stat label="Coins" value={d.coins} />
              <Stat label="Streak" value={d.currentStreak} />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Liga</p>
              {d.league ? <Badge variant="secondary">{d.league.name || `tier ${d.league.tier}`} · {d.league.weeklyXp} xp</Badge>
                : <span className="text-muted-foreground text-xs">Ligada emas</span>}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Nishonlar ({(d.badges || []).length})</p>
              <div className="flex flex-wrap gap-1">
                {(d.badges || []).length === 0 ? <span className="text-muted-foreground text-xs">Yo'q</span>
                  : d.badges.map((b: any) => <Badge key={b.key} variant="outline" className="gap-1"><Award className="w-3 h-3" />{b.key}</Badge>)}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Oxirgi 10 natija</p>
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {(d.recentResults || []).length === 0 ? <p className="text-muted-foreground text-xs p-2">Natija yo'q</p> :
                  d.recentResults.map((r: any, i: number) => (
                    <div key={i} className="flex justify-between px-2 py-1 text-xs border-b last:border-0">
                      <span>{r.wpm} wpm · {r.accuracy}%</span>
                      <span className="text-muted-foreground">{r.mode}s · {r.source}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Tahrir */}
            <div className="border-t pt-3">
              <p className="font-semibold mb-2">Tahrirlash (absolut qiymat)</p>
              <div className="flex items-end gap-2">
                <div className="flex-1"><Label className="text-xs">XP</Label><Input type="number" min="0" placeholder={String(d.xp)} value={xp} onChange={(e) => setXp(e.target.value)} /></div>
                <div className="flex-1"><Label className="text-xs">Coins</Label><Input type="number" min="0" placeholder={String(d.coins)} value={coins} onChange={(e) => setCoins(e.target.value)} /></div>
                <Button size="sm" onClick={saveEdit}>Saqlash</Button>
              </div>
            </div>

            {/* Grant */}
            <div className="border-t pt-3">
              <p className="font-semibold mb-2 flex items-center gap-1"><Gift className="w-4 h-4" /> Berish</p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs">Turi</Label>
                  <select className="block h-9 rounded-md border border-input bg-background px-2 text-sm" value={grantType} onChange={(e) => setGrantType(e.target.value as any)}>
                    <option value="coins">Coins</option>
                    <option value="xp">XP</option>
                    <option value="badge">Badge</option>
                  </select>
                </div>
                {grantType === "badge" ? (
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-xs">Nishon</Label>
                    <select className="block w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={grantBadgeId} onChange={(e) => setGrantBadgeId(e.target.value)}>
                      <option value="">— tanlang —</option>
                      {(badgeCatalog || []).map((b: any) => <option key={b.id} value={b.id}>{b.key}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="w-24"><Label className="text-xs">Miqdor</Label><Input type="number" min="1" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} /></div>
                )}
                <div className="flex-1 min-w-[120px]"><Label className="text-xs">Sabab</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ixtiyoriy" /></div>
                <Button size="sm" onClick={doGrant}>Berish</Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Yopish</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-primary">{value ?? "—"}</p>
    </div>
  );
}

// ============ LIGALAR ============
function LeaguesTab() {
  const { data: leagues, isLoading, isError, error } = useQuery<any[]>({ queryKey: ["/api/admin/leagues"] });
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Ligalar</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} /> : (leagues || []).length === 0 ? <EmptyBox text="Liga yo'q" /> : (
          <div className="space-y-4">
            {(leagues || []).map((lg: any) => (
              <div key={lg.tier} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{lg.name}</span>
                  <Badge variant="outline">tier {lg.tier}</Badge>
                  <span className="text-xs text-muted-foreground">{(lg.members || []).length} a'zo</span>
                </div>
                {(lg.members || []).length === 0 ? <p className="text-xs text-muted-foreground">A'zo yo'q</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nick</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Haftalik XP</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {lg.members.map((m: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-medium">{m.firstName || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{m.email || "—"}</TableCell>
                            <TableCell className="text-right font-mono">{m.weeklyXp}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ JANGLAR ============
function BattlesTab() {
  const { data: battles, isLoading, isError, error } = useQuery<any[]>({ queryKey: ["/api/admin/battles"] });
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Oxirgi janglar</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} /> : (battles || []).length === 0 ? <EmptyBox text="Jang yo'q" /> : (
          <div className="space-y-3">
            {(battles || []).map((b: any) => (
              <div key={b.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono font-bold">{b.code}</span>
                  <Badge variant={b.status === "finished" ? "secondary" : "outline"}>{b.status}</Badge>
                  <span className="text-xs text-muted-foreground">{b.language} · {b.mode}s · {(b.participants || []).length} ishtirokchi</span>
                </div>
                {(b.participants || []).length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Nick</TableHead><TableHead>WPM</TableHead><TableHead>Acc</TableHead><TableHead>G'olib</TableHead><TableHead className="text-right">XP/Coin</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {b.participants.map((p: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{p.firstName || p.email || "—"}</TableCell>
                            <TableCell>{p.wpm ?? "—"}</TableCell>
                            <TableCell>{p.accuracy ?? "—"}%</TableCell>
                            <TableCell>{p.isWinner ? <Badge className="gap-1"><Trophy className="w-3 h-3" />ha</Badge> : "—"}</TableCell>
                            <TableCell className="text-right font-mono">{p.xpAwarded}/{p.coinsAwarded}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ AUDIT LOG ============
function AuditTab() {
  const { data: rows, isLoading, isError, error } = useQuery<any[]>({ queryKey: ["/api/admin/audit-log"] });
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Audit jurnali (oxirgi 100)</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} /> : (rows || []).length === 0 ? <EmptyBox text="Amal yo'q" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Vaqt</TableHead><TableHead>Admin</TableHead><TableHead>Amal</TableHead><TableHead>Tafsilot</TableHead></TableRow></TableHeader>
              <TableBody>
                {(rows || []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{r.adminEmail || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{JSON.stringify(r.details)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MUSOBAQALAR ============
function CompetitionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: comps, isLoading, isError, error } = useQuery<any[]>({ queryKey: ["/api/admin/competitions"] });
  const [form, setForm] = useState({ title: "", description: "", reward: "", startTime: "", endTime: "" });

  async function createComp(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest("POST", "/api/admin/competitions", {
        title: form.title,
        description: form.description,
        reward: form.reward,
        startTime: form.startTime ? new Date(form.startTime).toISOString() : new Date().toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      });
      toast({ title: "Musobaqa yaratildi", description: form.title });
      setForm({ title: "", description: "", reward: "", startTime: "", endTime: "" });
      qc.invalidateQueries({ queryKey: ["/api/admin/competitions"] });
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  }

  async function del(id: any) {
    try {
      await apiRequest("DELETE", `/api/admin/competitions/${id}`);
      toast({ title: "O'chirildi" });
      qc.invalidateQueries({ queryKey: ["/api/admin/competitions"] });
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Yangi musobaqa</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createComp} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Sarlavha</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Tavsif</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Sovrin</Label>
              <Input value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} placeholder="Masalan: 100 000 so'm" /></div>
            <div />
            <div><Label>Boshlanish</Label>
              <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><Label>Tugash</Label>
              <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <Button type="submit" className="gap-1.5"><Trophy className="w-4 h-4" /> Yaratish</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Faol musobaqalar</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} /> : (comps || []).length === 0 ? (
            <EmptyBox text="Hozircha musobaqa yo'q" />
          ) : (
            <div className="space-y-2">
              {(comps || []).map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.reward || "sovrin yo'q"}</p>
                  </div>
                  <ConfirmButton
                    triggerLabel="O'chirish"
                    triggerIcon={<Trash2 className="w-3.5 h-3.5" />}
                    title="Musobaqani o'chirish"
                    description={`"${c.title}" o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
                    confirmLabel="O'chirish"
                    onConfirm={() => del(c.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ KODLAR ============
function CodesTab({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [maxP, setMaxP] = useState("10");
  const [lastResult, setLastResult] = useState<any>(null);
  const [checkCode, setCheckCode] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  function randomCode() { setCode("ROOM-" + Math.floor(1000 + Math.random() * 9000)); }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiRequest("POST", "/api/admin/creation-codes", {
        code: code || "ROOM-" + Math.floor(1000 + Math.random() * 9000),
        maxParticipants: maxP,
        createdBy: currentUserId,
      });
      const data = await res.json();
      setLastResult(data);
      toast({ title: "Kod yaratildi", description: data.code });
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  }

  async function checkStatus(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true); setStatus(null);
    try {
      const res = await apiRequest("GET", `/api/admin/creation-codes/status/${encodeURIComponent(checkCode)}`);
      setStatus(await res.json());
    } catch (e: any) {
      toast({ title: "Topilmadi", description: e.message, variant: "destructive" });
    } finally { setChecking(false); }
  }

  async function deactivate(c: string) {
    try {
      await apiRequest("POST", "/api/admin/creation-codes/deactivate", { code: c });
      toast({ title: "Kod deaktivatsiya qilindi", description: c });
      setStatus((s: any) => s ? { ...s, isUsed: true } : s);
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Xona yaratish kodi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={generate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-1"><Label>Kod</Label>
              <div className="flex gap-1">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ROOM-1234" />
                <Button type="button" variant="outline" size="icon" onClick={randomCode}><RefreshCw className="w-4 h-4" /></Button>
              </div>
            </div>
            <div><Label>Maks. ishtirokchi</Label>
              <Input type="number" min="1" value={maxP} onChange={(e) => setMaxP(e.target.value)} /></div>
            <Button type="submit" className="gap-1.5"><KeyRound className="w-4 h-4" /> Generatsiya</Button>
          </form>

          {lastResult && (
            <div className="border rounded-lg p-4 bg-muted/40">
              <p className="text-sm text-muted-foreground mb-1">Yaratilgan kod:</p>
              <p className="text-2xl font-mono font-bold text-primary">{lastResult.code}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Maks: {lastResult.maxParticipants} · muddati: {lastResult.expiresAt ? new Date(lastResult.expiresAt).toLocaleDateString() : "—"}
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Kod 5 kun amal qiladi.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Kod holatini tekshirish</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={checkStatus} className="flex gap-2">
            <Input placeholder="ROOM-1234" value={checkCode} onChange={(e) => setCheckCode(e.target.value)} />
            <Button type="submit" disabled={!checkCode || checking}>{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tekshirish"}</Button>
          </form>
          {status && (
            <div className="border rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">{status.code}</span>
                {status.isUsed
                  ? <Badge variant="secondary">Ishlatilgan/o'chirilgan</Badge>
                  : <Badge variant="outline" className="text-green-600 border-green-600">Aktiv</Badge>}
                {status.isExpired && <Badge variant="destructive">Muddati o'tgan</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Xona holati: {status.roomStatus} · maks: {status.maxParticipants}</p>
              {!status.isUsed && (
                <ConfirmButton
                  triggerLabel="Deaktivatsiya"
                  triggerIcon={<Trash2 className="w-3.5 h-3.5" />}
                  title="Kodni deaktivatsiya qilish"
                  description={`"${status.code}" ishlatib bo'lmaydigan holatga o'tadi.`}
                  confirmLabel="Deaktivatsiya"
                  onConfirm={() => deactivate(status.code)}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ XABAR (BROADCAST) ============
function BroadcastTab() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/admin/broadcast", { text });
      const d = await res.json();
      toast({ title: "Yuborildi", description: d.message || "OK" });
    } catch (e: any) {
      toast({ title: "Yuborilmadi", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Ommaviy xabar (Telegram)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">Telegram bot tokeni kerak</p>
            <p className="text-xs text-muted-foreground">
              Xabar foydalanuvchilarga faqat <code>USER_BOT_TOKEN</code>/<code>ADMIN_BOT_TOKEN</code> sozlangan va
              userlarda <code>telegram_id</code> bo'lganda yetib boradi. Local'da o'chiq — yuborish 0 userga ketadi.
            </p>
          </div>
        </div>
        <form onSubmit={send} className="space-y-3">
          <div><Label>Xabar matni</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Barcha foydalanuvchilarga xabar…" required /></div>
          <Button type="submit" disabled={sending || !text} className="gap-1.5">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Yuborish
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============ SOZLAMALAR ============
function SettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading, isError, error } = useQuery<any[]>({ queryKey: ["/api/admin/settings"] });
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest("POST", "/api/admin/settings", { key, value });
      toast({ title: "Saqlandi", description: key });
      setKey(""); setValue("");
      qc.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Sozlama qo'shish / o'zgartirish</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div><Label>Kalit (key)</Label><Input required value={key} onChange={(e) => setKey(e.target.value)} placeholder="masalan: welcome_bonus" /></div>
            <div><Label>Qiymat (value)</Label><Input required value={value} onChange={(e) => setValue(e.target.value)} placeholder="masalan: 100" /></div>
            <Button type="submit">Saqlash</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Mavjud sozlamalar</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Spinner /> : isError ? <ErrorBox error={error} /> : (settings || []).length === 0 ? (
            <EmptyBox text="Sozlamalar yo'q" />
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Kalit</TableHead><TableHead>Qiymat</TableHead></TableRow></TableHeader>
              <TableBody>
                {(settings || []).map((s: any) => (
                  <TableRow key={s.key}>
                    <TableCell className="font-mono">{s.key}</TableCell>
                    <TableCell>{String(s.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
