import { useEffect, useState } from "react";

export function useTheme() {
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">("auto");
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const isDark = themeMode === "dark" || (themeMode === "auto" && systemDark);
  const themeIcon = themeMode === "dark" ? "☀" : themeMode === "light" ? "🖥" : "◑";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function cycleTheme() {
    setThemeMode((m) => (m === "light" ? "dark" : m === "dark" ? "auto" : "light"));
  }

  return { themeMode, isDark, themeIcon, cycleTheme };
}
