import { apiFetch, setToken } from "./client";

export interface User {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

export async function register(email: string, password: string): Promise<void> {
  const res = await apiFetch(`/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Register error: ${res.status}`);
  }
}

export async function login(email: string, password: string): Promise<User> {
  const res = await apiFetch(`/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid email or password");
  const data = (await res.json()) as TokenResponse;
  setToken(data.access_token);
  try {
    return await fetchMe();
  } catch (e) {
    setToken(null);
    throw e;
  }
}

export async function fetchMe(): Promise<User> {
  const res = await apiFetch(`/api/auth/me`);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json() as Promise<User>;
}

export function logout(): void {
  setToken(null);
}
