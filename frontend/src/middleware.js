import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Routes that need a session. Profiles (/:username) and /design stay public.
// This is a UX redirect, not the security boundary: the API verifies the Clerk
// token on every request.
const PROTECTED = [
  /^\/$/,
  /^\/explore(?:\/|$)/,
  /^\/notifications(?:\/|$)/,
  /^\/messages(?:\/|$)/,
  /^\/bookmarks(?:\/|$)/,
  /^\/settings(?:\/|$)/,
];

function isProtected(pathname) {
  return PROTECTED.some((pattern) => pattern.test(pathname));
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname, search } = request.nextUrl;

  // Password resets are Clerk's job now. Old emailed links and bookmarks point
  // at these paths; without this they would fall through to /[username].
  if (pathname === "/forgot-password" || pathname === "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isProtected(pathname)) return;

  const { userId } = await auth();
  if (userId) return;

  const url = request.nextUrl.clone();
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
