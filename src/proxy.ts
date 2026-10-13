import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before the admin pages: visitors without a session cookie go to /login.
 * The study page (/) is open to guests, so it is not matched here.
 * This is only a fast first check; every API route and the admin page verify the session for real.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has('kk_session')) return NextResponse.next();
  const url = new URL('/login', req.url);
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};
