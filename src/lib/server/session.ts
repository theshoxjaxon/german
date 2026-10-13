/**
 * Sessions: who is signed in.
 *
 * The cookie holds a random 256-bit token; the database stores only its hash.
 * Cookie flags: HttpOnly (JavaScript can't read it), SameSite=Lax (other sites can't send it
 * with a POST/PUT/DELETE), Secure whenever the site is served over HTTPS.
 */
import { cookies, headers } from 'next/headers';
import { DAY, MIN } from '../time';
import * as repo from './repo';

export const SESSION_COOKIE = 'kk_session';
const TTL = 30 * DAY;
const RENEW_BELOW = 15 * DAY; // sliding expiry: active users stay signed in
const VISIT_EVERY = 5 * MIN;

async function isHttps(): Promise<boolean> {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === 'true';
  const proto = (await headers()).get('x-forwarded-proto') ?? '';
  return proto.split(',')[0].trim() === 'https';
}

async function writeCookie(token: string, expiresAt: number) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isHttps(),
    path: '/',
    expires: new Date(expiresAt),
  });
}

/** Sign in: create a session and set the cookie. Server Actions and Route Handlers only. */
export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await repo.createSession(userId, TTL);
  await writeCookie(token, expiresAt);
}

/** Sign out this browser. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await repo.deleteSession(token);
  jar.delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token && token.length <= 100 ? token : undefined;
}

/** The signed-in user, or null. Safe to call from Server Components (read-only). */
export async function currentUser(): Promise<repo.UserRow | null> {
  const token = await sessionToken();
  if (!token) return null;
  return (await repo.findSession(token))?.user ?? null;
}

const json = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Reject requests whose Origin is another site (defense in depth on top of SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type Guard = { user: repo.UserRow; response?: undefined } | { user?: undefined; response: Response };

/**
 * Use at the top of every Route Handler:
 *   const auth = await requireUser(req); if (auth.response) return auth.response;
 * Renews the session when it is getting old and records the visit for the admin dashboard.
 */
export async function requireUser(req: Request, opts: { admin?: boolean } = {}): Promise<Guard> {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) return { response: json(403, 'Cross-site request blocked.') };
  const jar = await cookies();
  const token = await sessionToken();
  const now = Date.now();
  const session = token ? await repo.findSession(token, now) : null;
  if (!session) {
    if (token) jar.delete(SESSION_COOKIE); // stale cookie: clear it so /login doesn't bounce back
    return { response: json(401, 'Sign in to continue.') };
  }
  const { user } = session;
  if (opts.admin && user.role !== 'admin') return { response: json(403, 'Only admins can do this.') };
  if (session.expiresAt - now < RENEW_BELOW) {
    const expiresAt = now + TTL;
    await repo.extendSession(token!, expiresAt);
    await writeCookie(token!, expiresAt);
  }
  if (!user.lastSeenAt || now - user.lastSeenAt > VISIT_EVERY) await repo.recordVisit(user.id, now);
  return { user };
}
