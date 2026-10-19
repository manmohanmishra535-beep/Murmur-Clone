import { NextResponse } from "next/server";

// Routes that need a session. Profiles (/:username) and /design stay public.
const REQUIRED = ["/", "/explore", "/notifications", "/messages", "/bookmarks", "/settings"];

function needsAuth(pathname) {
  return REQUIRED.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`))
  );
}

/**
 * Cookie presence is the only check middleware can make without the JWT secret.
 * It does not redirect signed-in users away from /login: an expired cookie
 * would then bounce forever between "/" and "/login". The login page itself
 * redirects once /api/auth/me confirms the session.
 *
 * The API verifies the token on every request, so this is a UX shortcut rather
 * than a security boundary.
 */
export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get("token"));

  if (needsAuth(pathname) && !hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
