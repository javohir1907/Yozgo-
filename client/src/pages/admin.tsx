import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: ads, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/advertisements"],
    enabled: user?.role === "admin",
  });

  const createAd = useMutation({
    mutationFn: async (adData: any) => {
      await apiRequest("POST", "/api/admin/advertisements", adData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/advertisements"] });
      setTitle("");
      setImageUrl("");
      setLinkUrl("");
      setStartDate("");
      setEndDate("");
    },
  });

  const toggleAd = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/advertisements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/advertisements"] });
    },
  });

  if (!user || user.role !== "admin") {
    return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 mt-16">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard - Reklamalar</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Yangi reklama qo'shish</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            createAd.mutate({ title, imageUrl, linkUrl, startDate, endDate });
          }} className="space-y-4">
            <div>
              <Label>Sarlavha (Title)</Label>
              <Input required value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Rasm URL (Upload o'rniga link)</Label>
              <Input required value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
            </div>
            <div>
              <Label>Havola URL (Link URL)</Label>
              <Input required value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            </div>
            <div>
              <Label>Boshlanish sanasi</Label>
              <Input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Tugash sanasi</Label>
              <Input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <Button type="submit" disabled={createAd.isPending}>Qo'shish</Button>
          </form>
        </div>

        <div className="bg-card p-6 rounded-lg shadow border">
          <h2 className="text-xl font-semibold mb-4">Mavjud reklamalar</h2>
          {isLoading ? <p>Yuklanmoqda...</p> : (
            <div className="space-y-4">
              {ads?.map((ad: any) => (
                <div key={ad.id} className="p-4 border rounded flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{ad.title}</h3>
                    <p className="text-sm text-muted-foreground">{new Date(ad.startDate).toLocaleDateString()} - {new Date(ad.endDate).toLocaleDateString()}</p>
                    <span className={`text-xs px-2 py-1 rounded ${ad.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {ad.isActive ? 'Faol' : 'O\'chirilgan'}
                    </span>
                  </div>
                  {ad.isActive && (
                    <Button variant="destructive" size="sm" onClick={() => toggleAd.mutate(ad.id)}>
                      O'chirish
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
