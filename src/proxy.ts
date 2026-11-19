import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before the private pages (/admin, /account): visitors without a session cookie go to
 * /login, and come back here after logging in. The study page (/) is open to guests, so it is
 * not matched. This is only a fast first check: each private page, and every API route,
 * verifies the session for real.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has('kk_session')) return NextResponse.next();
  const url = new URL('/login', req.url);
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/account'],
};
