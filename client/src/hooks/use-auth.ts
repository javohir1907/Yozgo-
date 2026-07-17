import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { apiRequest, normalizeUrl } from "@/lib/queryClient";

type SafeUser = Omit<User, "password">;

async function fetchUser(): Promise<SafeUser | null> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("yozgo_session");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(normalizeUrl("/api/auth/user"), {
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<SafeUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const persist = (data: any) => {
    if (data?.token) localStorage.setItem("yozgo_session", data.token);
    queryClient.setQueryData(["/api/auth/user"], data);
  };

  const loginMutation = useMutation({
    mutationFn: async (data: { emailOrUsername: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: persist,
  });

  const registerMutation = useMutation({
    // emailCode/telegramCode YO'Q — kanallar oldin verify-email/verify-telegram orqali
    // alohida tasdiqlanadi; server verified=true qatorlarni tekshiradi.
    // emailToken — verify-email qaytargan bir martalik isbot (sessiya bog'lash).
    mutationFn: async (data: {
      username: string;
      email: string;
      password: string;
      gender: "male" | "female";
      emailToken: string;
      telegramToken: string;
    }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: persist,
  });

  const telegramLoginMutation = useMutation({
    mutationFn: async (data: { token: string; code: string }) => {
      const res = await apiRequest("POST", "/api/auth/login/telegram", data);
      return res.json();
    },
    onSuccess: persist,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      localStorage.removeItem("yozgo_session");
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    loginTelegram: telegramLoginMutation.mutateAsync,
    logout: logoutMutation.mutate,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isTelegramLoggingIn: telegramLoginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
