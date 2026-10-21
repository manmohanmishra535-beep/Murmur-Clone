import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuth as useClerkAuth, useClerk } from "@clerk/nextjs";
import { authService } from "@/services/authService";
import { setTokenGetter, setUnauthorizedHandler } from "@/services/api";

export const AuthContext = createContext(null);

/**
 * Clerk owns the session; this provider turns it into the app's profile.
 *
 * status: "loading" while Clerk loads or /auth/me is in flight, then
 * "authenticated" | "guest". Every request carries the Clerk session token as
 * a bearer header, so no cookie is read or written by the app.
 */
export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const router = useRouter();

  const clearSession = useCallback(() => {
    setUser(null);
    setStatus("guest");
  }, []);

  // Axios asks Clerk for a fresh token on every call; the SDK refreshes an
  // expiring session token itself. Declared before the hydration effect so it
  // is registered by the time the first request leaves.
  useEffect(() => {
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);

  // One place decides what happens when the API rejects the session. Signing
  // out of Clerk as well prevents a redirect loop when the token is valid for
  // Clerk but not for this API (a misconfigured authorized party, say).
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      clearSession();
      try {
        await signOut();
      } catch {
        // Already signed out, or offline: the redirect below still applies.
      }
      const next =
        router.asPath && !["/login", "/register"].includes(router.pathname)
          ? `?next=${encodeURIComponent(router.asPath)}`
          : "";
      router.replace(`/login${next}`);
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, router, signOut]);

  // Hydrate the app profile whenever the Clerk session appears or changes.
  //
  // A failed request is not proof that the session ended. Render's free
  // instance sleeps after 15 minutes, so the first call of the day can time out
  // or return a 502 while the container boots. Treating that as "guest" used to
  // bounce the signed-in user to /login, which sent them straight back here:
  // an endless redirect loop. Only a 401 means the token was refused; anything
  // else keeps the session and retries until the API answers.
  useEffect(() => {
    if (!isLoaded) return undefined;

    if (!isSignedIn) {
      clearSession();
      return undefined;
    }

    let active = true;
    let attempt = 0;
    let timer;

    setStatus("loading");

    const load = () => {
      authService
        .me()
        .then(({ user: current }) => {
          if (!active) return;
          setUser(current);
          setStatus("authenticated");
        })
        .catch(async (error) => {
          if (!active) return;

          if (error.response && error.response.status === 401) {
            // Clerk still holds a session but the API refused its token (keys
            // or authorized parties are wrong). Drop the session so /login
            // does not bounce the user back into this loop.
            clearSession();
            try {
              await signOut();
            } catch {
              // Already gone; the redirect below still applies.
            }
            return;
          }

          attempt += 1;
          const delay = Math.min(2000 * 2 ** (attempt - 1), 20000);
          timer = setTimeout(load, delay);
        });
    };

    load();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isLoaded, isSignedIn, clearSession, signOut]);

  const logout = useCallback(async () => {
    try {
      await signOut();
    } finally {
      clearSession();
    }
  }, [signOut, clearSession]);

  /** Merge a server response into the cached user after a profile save. */
  const updateUser = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo(
    () => ({ user, status, logout, updateUser, refresh: authService.me }),
    [user, status, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
