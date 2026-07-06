import { useEffect, useState } from "react";
import {
  fetchAdminUsers,
  fetchAdminStats,
  resetUserPassword,
  setUserAdmin,
  deleteUser,
  type AdminUser,
  type AdminStats,
} from "../api/admin";

interface AdminPanelProps {
  currentUserId: number;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPanel({ currentUserId }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  function loadAll() {
    setLoading(true);
    setError("");
    Promise.all([fetchAdminUsers(), fetchAdminStats()])
      .then(([u, s]) => {
        setUsers(u);
        setStats(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load admin data"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleResetSubmit(userId: number) {
    if (resetPassword.length < 8) return;
    setBusyId(userId);
    setError("");
    try {
      await resetUserPassword(userId, resetPassword);
      setResetTargetId(null);
      setResetPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleAdmin(user: AdminUser) {
    setBusyId(user.id);
    setError("");
    try {
      await setUserAdmin(user.id, !user.is_admin);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_admin: !u.is_admin } : u))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update admin status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!window.confirm(`Delete ${user.email}? This removes all their notes and data.`)) return;
    setBusyId(user.id);
    setError("");
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="admin-pane">
      <div className="admin-header">
        <h2 className="admin-title">Admin</h2>
        {stats && (
          <div className="admin-stats">
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.total_users}</span>
              <span className="admin-stat-label">Users</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.total_notes}</span>
              <span className="admin-stat-label">Notes</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.total_chat_sessions}</span>
              <span className="admin-stat-label">Chat sessions</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.total_chat_turns}</span>
              <span className="admin-stat-label">Chat turns</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.signups_last_7_days}</span>
              <span className="admin-stat-label">Signups (7d)</span>
            </div>
          </div>
        )}
      </div>

      <div className="admin-body">
        {loading && <div className="library-empty">Loading…</div>}
        {error && <div className="admin-error">{error}</div>}

        {!loading && users.length === 0 && (
          <div className="library-empty">No users yet.</div>
        )}

        {!loading && users.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Joined</th>
                <th>Last login</th>
                <th>Notes</th>
                <th>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{formatDate(u.created_at)}</td>
                  <td>{formatDate(u.last_login_at)}</td>
                  <td>{u.note_count}</td>
                  <td>{u.is_admin ? <span className="admin-badge">Admin</span> : "—"}</td>
                  <td className="admin-actions">
                    <button
                      className="admin-action-btn"
                      disabled={busyId === u.id}
                      onClick={() => {
                        setResetTargetId(resetTargetId === u.id ? null : u.id);
                        setResetPassword("");
                      }}
                    >
                      Reset password
                    </button>
                    <button
                      className="admin-action-btn"
                      disabled={busyId === u.id || (u.id === currentUserId && u.is_admin)}
                      onClick={() => handleToggleAdmin(u)}
                    >
                      {u.is_admin ? "Demote" : "Promote"}
                    </button>
                    <button
                      className="admin-action-btn admin-action-btn--danger"
                      disabled={busyId === u.id || u.id === currentUserId}
                      onClick={() => handleDelete(u)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {resetTargetId !== null && (
          <div className="admin-reset-row">
            <input
              className="auth-input admin-reset-input"
              type="password"
              placeholder="New password (min 8 characters)"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              minLength={8}
              autoFocus
            />
            <button
              className="admin-action-btn"
              disabled={resetPassword.length < 8 || busyId === resetTargetId}
              onClick={() => handleResetSubmit(resetTargetId)}
            >
              Save
            </button>
            <button className="admin-action-btn" onClick={() => setResetTargetId(null)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
