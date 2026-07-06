import { useEffect, useState, type ReactNode } from "react";
import { getToken } from "../api/client";
import { login, register, logout, fetchMe, type User } from "../api/auth";

interface AuthGateProps {
  children: (user: User, onLogout: () => void, justRegistered: boolean) => ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [isDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
    }
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register(email, password);
      }
      const loggedIn = await login(email, password);
      setUser(loggedIn);
      if (mode === "register") setJustRegistered(true);
    } catch {
      setError(
        mode === "login"
          ? "Invalid email or password"
          : "Could not create account — email may already be in use, or password is too short"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;

  if (!user) {
    return (
      <div className={`app auth-gate${isDark ? " theme-dark" : ""}`}>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1 className="auth-title">Rhymathic</h1>
          <p className="auth-subtitle">
            {mode === "login" ? "Sign in to continue" : "Create an account"}
          </p>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setMode((m) => (m === "login" ? "register" : "login"));
              setError("");
            }}
          >
            {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children(user, () => { logout(); setUser(null); }, justRegistered)}</>;
}
