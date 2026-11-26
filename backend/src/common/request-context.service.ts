import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';
import { COURSE_COOKIE } from '@/lib/courses';

export interface CookieOptions { maxAgeSeconds?: number; expires?: Date }

/**
 * The HTTP request being served, for code that is not a controller (sessions, rate limits, mail
 * links). Backed by AsyncLocalStorage, so services stay singletons instead of becoming request-scoped.
 */
@Injectable()
export class RequestContext {
  constructor(private readonly cls: ClsService) {}

  get req(): Request {
    return this.cls.get<Request>('req');
  }
  get res(): Response {
    return this.cls.get<Response>('res');
  }
  /** True outside a request (cron jobs, startup). */
  get none(): boolean {
    return !this.cls.isActive() || !this.cls.get('req');
  }

  header(name: string): string | undefined {
    const v = this.none ? undefined : this.req.headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  }

  cookie(name: string): string | undefined {
    const raw = this.header('cookie');
    if (!raw) return undefined;
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === name) {
        try {
          return decodeURIComponent(part.slice(i + 1).trim());
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  /** Sessions and the guest's course are HttpOnly + SameSite=Lax; Secure whenever the site is served over HTTPS. */
  setCookie(name: string, value: string, opts: CookieOptions = {}): void {
    this.res.cookie(name, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isHttps(),
      path: '/',
      ...(opts.expires ? { expires: opts.expires } : {}),
      ...(opts.maxAgeSeconds ? { maxAge: opts.maxAgeSeconds * 1000 } : {}),
    });
  }

  clearCookie(name: string): void {
    this.res.clearCookie(name, { path: '/', httpOnly: true, sameSite: 'lax', secure: this.isHttps() });
  }

  isHttps(): boolean {
    if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === 'true';
    return (this.header('x-forwarded-proto') ?? '').split(',')[0].trim() === 'https';
  }

  /** The host the browser used: the web app proxies /api here and sends it along as X-Forwarded-Host. */
  get host(): string {
    return this.header('x-forwarded-host') ?? this.header('host') ?? 'localhost';
  }

  clientIp(): string {
    return (this.header('x-forwarded-for')?.split(',')[0] || this.header('x-real-ip') || 'local').trim();
  }

  /** The course a guest picked (cookie), if it is one we know. */
  get courseCookie(): string | undefined {
    return this.cookie(COURSE_COOKIE);
  }
}
