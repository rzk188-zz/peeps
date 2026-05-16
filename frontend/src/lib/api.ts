import { storage } from "@/src/utils/storage";

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const TOKEN_KEY = "peeps_session_token";

export async function getToken(): Promise<string | null> {
  return (await storage.secureGet(TOKEN_KEY, null)) as string | null;
}

export async function setToken(token: string): Promise<void> {
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await storage.secureRemove(TOKEN_KEY);
}

async function request<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail = JSON.parse(text).detail || text;
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export const api = {
  createSession: (session_token: string) =>
    request<{ session_token: string; user: any }>("/auth/session", {
      method: "POST",
      body: { session_token },
      auth: false,
    }),
  me: () => request<any>("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  catalog: () => request<any[]>("/catalog", { auth: false }),
  getMyHouse: () => request<any>("/house/me"),
  updateMyHouse: (data: any) =>
    request<any>("/house/me", { method: "PUT", body: data }),
  getHouse: (user_id: string) => request<any>(`/house/${user_id}`),
  listFriends: () => request<any[]>("/friends"),
  addFriend: (friend_code: string) =>
    request<any>("/friends/add", { method: "POST", body: { friend_code } }),
  listRequests: () => request<any[]>("/friends/requests"),
  acceptRequest: (id: string) =>
    request(`/friends/requests/${id}/accept`, { method: "POST" }),
  rejectRequest: (id: string) =>
    request(`/friends/requests/${id}/reject`, { method: "POST" }),
  getChat: (user_id: string) => request<any[]>(`/chat/${user_id}`),
  sendChat: (user_id: string, text: string) =>
    request<any>(`/chat/${user_id}`, { method: "POST", body: { text } }),
  chatList: () => request<any[]>("/chat-list"),
  cohabMe: () => request<any>("/cohab/me"),
  inviteCohab: (to_user_id: string) =>
    request<any>("/cohab/invite", { method: "POST", body: { to_user_id } }),
  listCohabInvites: () => request<any[]>("/cohab/invites"),
  acceptCohab: (id: string) =>
    request<any>(`/cohab/invites/${id}/accept`, { method: "POST" }),
  rejectCohab: (id: string) =>
    request(`/cohab/invites/${id}/reject`, { method: "POST" }),
  updateCohab: (data: any) =>
    request<any>("/cohab/me", { method: "PUT", body: data }),
  leaveCohab: () => request("/cohab/me", { method: "DELETE" }),
  getCohabChat: () => request<any[]>("/cohab/chat"),
  sendCohabChat: (text: string) =>
    request<any>("/cohab/chat", { method: "POST", body: { text } }),
  updateAppearance: (data: any) =>
    request<any>("/auth/appearance", { method: "PUT", body: data }),
};
