import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MIN, DAY } from '@/lib/time';
import { RequestContext } from '@api/common/request-context.service';
import { CoursesRepository } from '@api/courses/courses.repository';
import { UsersRepository, type UserRow } from '@api/users/users.repository';
import { AuthRepository } from './auth.repository';

export const SESSION_COOKIE = 'kk_session';
const TTL = 30 * DAY;
const RENEW_BELOW = 15 * DAY; // sliding expiry: active users stay signed in
const VISIT_EVERY = 5 * MIN;

/**
 * Sessions: who is signed in.
 *
 * The cookie holds a random 256-bit token; the database stores only its hash.
 * Cookie flags: HttpOnly (JavaScript can't read it), SameSite=Lax (other sites can't send it
 * with a POST/PUT/DELETE), Secure whenever the site is served over HTTPS.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly ctx: RequestContext,
    private readonly auth: AuthRepository,
    private readonly courses: CoursesRepository,
    private readonly users: UsersRepository,
  ) {}

  /** Sign in: create a session and set the cookie. */
  async start(userId: string): Promise<void> {
    const { token, expiresAt } = await this.auth.createSession(userId, TTL);
    this.ctx.setCookie(SESSION_COOKIE, token, { expires: new Date(expiresAt) });
  }

  /** Sign out this browser. */
  async end(): Promise<void> {
    const token = this.token();
    if (token) await this.auth.deleteSession(token);
    this.ctx.clearCookie(SESSION_COOKIE);
  }

  token(): string | undefined {
    const token = this.ctx.cookie(SESSION_COOKIE);
    return token && token.length <= 100 ? token : undefined;
  }

  /** The signed-in user, or null. Read-only: it doesn't renew the session. */
  async current(): Promise<UserRow | null> {
    const token = this.token();
    return token ? ((await this.auth.findSession(token))?.user ?? null) : null;
  }

  /** Reject requests whose Origin is another site (defense in depth on top of SameSite cookies). */
  sameOrigin(): boolean {
    const origin = this.ctx.header('origin');
    if (!origin) return true;
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return false;
    }
    if (host === this.ctx.host) return true;
    // The web app proxies /api to this server, so the browser's host is the web app's, not ours.
    return this.trustedHosts().has(host);
  }

  /** Non-GET requests from another site's pages are refused. Calls without an Origin (curl, webhooks, cron) pass: they carry no victim's browser cookie. */
  assertSameOrigin(): void {
    const method = this.ctx.req.method;
    if (method !== 'GET' && method !== 'HEAD' && !this.sameOrigin()) throw new ForbiddenException('Cross-site request blocked.');
  }

  private trustedHosts(): Set<string> {
    const list = [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS ?? '').split(',')];
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) list.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
    const hosts = new Set<string>();
    for (const v of list) {
      try {
        if (v?.trim()) hosts.add(new URL(v.trim()).host);
      } catch {
        /* a malformed entry trusts nothing */
      }
    }
    return hosts;
  }

  /**
   * Who is calling: the user behind the cookie. Renews the session when it is getting old and
   * records the visit for the admin dashboard. With `optional`, a guest gives null instead of 401.
   */
  async authenticate(opts: { admin?: boolean; optional?: boolean } = {}): Promise<UserRow | null> {
    this.assertSameOrigin();
    const token = this.token();
    const now = Date.now();
    const session = token ? await this.auth.findSession(token, now) : null;
    if (!session) {
      if (token) this.ctx.clearCookie(SESSION_COOKIE); // stale cookie: clear it so /login doesn't bounce back
      if (opts.optional) return null;
      throw new UnauthorizedException('Sign in to continue.');
    }
    let { user } = session;
    if (opts.admin && user.role !== 'admin') throw new ForbiddenException('Only admins can do this.');
    // A profile made while an older version was still running (or whose course was deleted)
    // joins its active course on its next request.
    if (!user.member && (await this.courses.joinCourse(user.id, user.courseId, now))) user = { ...user, member: true, inClass: true };
    if (session.expiresAt - now < RENEW_BELOW) {
      const expiresAt = now + TTL;
      await this.auth.extendSession(token!, expiresAt);
      this.ctx.setCookie(SESSION_COOKIE, token!, { expires: new Date(expiresAt) });
    }
    if (!user.lastSeenAt || now - user.lastSeenAt > VISIT_EVERY) await this.users.recordVisit(user.id, now);
    return user;
  }
}
