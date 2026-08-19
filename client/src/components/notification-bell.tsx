import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const query = useQuery<{ items: NotificationItem[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    // The global defaults are refetchInterval:false + staleTime:Infinity, so
    // without overriding BOTH of these the bell only ever updated on a full
    // page reload — a battle invite could sit unseen indefinitely.
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const markAllRead = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const unreadCount = query.data?.unreadCount ?? 0;
  const items = query.data?.items ?? [];

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Ochilganda hammasi o'qilgan deb belgilanadi — badge tozalanadi.
        if (next && unreadCount > 0) markAllRead.mutate();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
          data-testid="button-notifications"
        >
          <Bell className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">{t.nav.notifications}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 font-sans rounded-xl border-2 p-2">
        <DropdownMenuLabel>{t.nav.notifications}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">{t.nav.noNotifications}</div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-1">
            {items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-0.5 rounded-lg cursor-pointer whitespace-normal ${!n.isRead ? "bg-primary/5" : ""}`}
                onClick={() => n.link && setLocation(n.link)}
                data-testid={`notification-${n.id}`}
              >
                <span className="text-sm font-medium leading-snug">{n.message}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(n.createdAt), "MMM d, HH:mm")}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
