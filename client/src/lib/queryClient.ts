import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const BASE_URL = import.meta.env.VITE_API_URL || "";

export function normalizeUrl(url: string) {
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Read the body once as text — a Response stream can only be consumed
    // once, so a failed res.json() followed by res.text() on the same
    // Response always throws "body stream already read" and hides the
    // real error. Parse the text in-memory instead.
    const raw = await res.text().catch(() => "");
    let errorMessage = raw || res.statusText;
    try {
      const errorData = JSON.parse(raw);
      errorMessage = errorData.message || errorMessage;
    } catch {
      /* raw isn't JSON — fall back to it as-is */
    }
    // The status code used to be prefixed onto the message ("402: Coin yetarli
    // emas"), so every toast in the app opened with a raw HTTP number. It is
    // carried as a property instead — available to code that needs it, invisible
    // to the reader.
    const err = new Error(errorMessage) as Error & { status?: number; code?: string };
    err.status = res.status;
    try {
      err.code = JSON.parse(raw)?.code;
    } catch {
      /* not JSON — no code to carry */
    }
    throw err;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const token = localStorage.getItem("yozgo_session");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(normalizeUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    const token = localStorage.getItem("yozgo_session");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(normalizeUrl(queryKey.join("/") as string), {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
