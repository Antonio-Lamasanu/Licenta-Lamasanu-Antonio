import { apiFetch } from "./client";

export interface AdminUser {
  id: number;
  email: string;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  note_count: number;
}

export interface AdminStats {
  total_users: number;
  total_notes: number;
  total_chat_sessions: number;
  total_chat_turns: number;
  signups_last_7_days: number;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await apiFetch(`/api/admin/users`);
  if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
  return res.json() as Promise<AdminUser[]>;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await apiFetch(`/api/admin/stats`);
  if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
  return res.json() as Promise<AdminStats>;
}

export async function resetUserPassword(userId: number, password: string): Promise<void> {
  const res = await apiFetch(`/api/admin/users/${userId}/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to reset password: ${res.status}`);
  }
}

export async function setUserAdmin(userId: number, isAdmin: boolean): Promise<void> {
  const res = await apiFetch(`/api/admin/users/${userId}/admin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_admin: isAdmin }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to update admin status: ${res.status}`);
  }
}

export async function deleteUser(userId: number): Promise<void> {
  const res = await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Failed to delete user: ${res.status}`);
  }
}
