import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that need a session. Profiles (/:username) and /design stay public.
const isProtected = createRouteMatcher([
  "/",
  "/explore(.*)",
  "/notifications(.*)",
  "/messages(.*)",
  "/bookmarks(.*)",
  "/settings(.*)",
]);

/**
 * Clerk's middleware refreshes the session and exposes it to this callback.
 * The redirect is a UX shortcut; the API verifies the bearer token on every
 * request, so this is not the security boundary.
 */
export default clerkMiddleware(async (auth, request) => {
  if (!isProtected(request)) return;

  const { userId } = await auth();
  if (userId) return;

  const url = request.nextUrl.clone();
  const { pathname, search } = request.nextUrl;
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
});

export const config = {
  // Everything except Next internals and files with an extension (the hashed
  // JS/CSS, the favicon, uploaded images).
  matcher: ["/((?!_next|.*\\..*).*)"],
};
