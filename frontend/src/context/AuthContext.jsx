import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { authService } from "@/services/authService";
import { setUnauthorizedHandler } from "@/services/api";

export const AuthContext = createContext(null);

/**
 * status: "loading" while /auth/me is in flight, then "authenticated" | "guest".
 * The token itself is an httpOnly cookie, so it is never read by JavaScript.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const router = useRouter();

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus("guest");
  }, []);

  // One place decides what happens when a session dies mid-app.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      const next =
        router.asPath && !["/login", "/register"].includes(router.pathname)
          ? `?next=${encodeURIComponent(router.asPath)}`
          : "";
      router.replace(`/login${next}`);
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, router]);

  // Hydrate from the cookie on first paint.
  useEffect(() => {
    let active = true;

    authService
      .me()
      .then(({ user: current }) => {
        if (!active) return;
        setUser(current);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("guest");
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: current } = await authService.login(credentials);
    setUser(current);
    setStatus("authenticated");
    return current;
  }, []);

  const register = useCallback(async (payload) => {
    const { user: current } = await authService.register(payload);
    setUser(current);
    setStatus("authenticated");
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  /** Merge a server response into the cached user after a profile save. */
  const updateUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, updateUser, refresh: authService.me }),
    [user, status, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
