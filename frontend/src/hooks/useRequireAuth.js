import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "./useAuth";

/**
 * Middleware already redirects when the cookie is missing. This covers the
 * other case: a Clerk session that is gone by the time the page hydrates.
 *
 * The redirect follows Clerk, not the API profile: a cold-starting API used to
 * look like "guest" and sent signed-in users to /login, where the auth page
 * sent them back — a reload loop. An API failure is not a signed-out session.
 */
export function useRequireAuth() {
  const { user, status } = useAuth();
  const { isLoaded, isSignedIn } = useClerkAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const next = router.asPath && router.asPath !== "/" ? `?next=${encodeURIComponent(router.asPath)}` : "";
    router.replace(`/login${next}`);
  }, [isLoaded, isSignedIn, router]);

  return { user, status, ready: status === "authenticated" };
}
