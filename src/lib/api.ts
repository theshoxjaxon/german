/**
 * The web app's way to the NestJS API (backend/) from the server: Server Components, Server
 * Actions and Route Handlers. The browser itself talks to /api/* and Next proxies that to the
 * API (next.config.ts), so cookies stay on this site's domain.
 *
 * `api()` calls the API as the person who made the request: it forwards their cookies and
 * address. In Server Actions and Route Handlers use `relayCookies()` to hand the API's
 * Set-Cookie (a new session, say) on to the browser.
 */
import { cookies, headers } from 'next/headers';

/** Where the API runs. Locally `npm run dev` in backend/ listens on 4000. */
export const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  /** The JSON body: the answer, or `{ error }` when `ok` is false. */
  data: T;
  setCookies: string[];
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const forward: Record<string, string> = { cookie: jar.toString(), 'x-forwarded-host': h.get('host') ?? '' };
  for (const name of ['x-forwarded-for', 'x-forwarded-proto', 'x-real-ip']) {
    const v = h.get(name);
    if (v) forward[name] = v;
  }
  const res = await fetch(`${API_URL}/api${path}`, {
    method: init.method ?? 'GET',
    headers: { ...forward, ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    redirect: 'manual',
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: 'The server sent an answer the app could not read.' };
  }
  return { ok: res.ok, status: res.status, data: data as T, setCookies: res.headers.getSetCookie() };
}

/** The error message of a failed call. */
export const errorOf = (r: ApiResult<unknown>): string => String((r.data as { error?: unknown })?.error ?? 'Something went wrong.');

type SameSite = 'lax' | 'strict' | 'none';

/** Copy the API's Set-Cookie headers onto this response (Server Actions and Route Handlers only). */
export async function relayCookies(setCookies: string[]): Promise<void> {
  const jar = await cookies();
  for (const line of setCookies) {
    const [pair, ...attrs] = line.split(';').map((p) => p.trim());
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const opts: { httpOnly?: boolean; secure?: boolean; path?: string; sameSite?: SameSite; expires?: Date; maxAge?: number } = {};
    for (const a of attrs) {
      const [k, v = ''] = a.split('=');
      const key = k.toLowerCase();
      if (key === 'httponly') opts.httpOnly = true;
      else if (key === 'secure') opts.secure = true;
      else if (key === 'path') opts.path = v;
      else if (key === 'samesite') opts.sameSite = v.toLowerCase() as SameSite;
      else if (key === 'expires') opts.expires = new Date(v);
      else if (key === 'max-age') opts.maxAge = Number(v);
    }
    jar.set(pair.slice(0, eq), decodeURIComponent(pair.slice(eq + 1)), opts);
  }
}
