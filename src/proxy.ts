import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before the app and admin pages: visitors without a session cookie go to /login.
 * This is only a fast first check; every API route and the admin page verify the session for real.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has('kk_session')) return NextResponse.next();
  const url = new URL('/login', req.url);
  if (req.nextUrl.pathname !== '/') url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/', '/admin/:path*'],
};
