import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "./useAuth";

/**
 * Middleware already redirects when the cookie is missing. This covers the
 * other case: a cookie that exists but no longer maps to a session.
 */
export function useRequireAuth() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "guest") return;
    const next = router.asPath && router.asPath !== "/" ? `?next=${encodeURIComponent(router.asPath)}` : "";
    router.replace(`/login${next}`);
  }, [status, router]);

  return { user, status, ready: status === "authenticated" };
}
