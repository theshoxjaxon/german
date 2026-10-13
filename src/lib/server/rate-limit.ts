/**
 * A tiny fixed-window rate limiter kept in memory, to slow down password guessing.
 * Per server process: fine for one server. Behind several instances, use a shared store (e.g. Redis).
 */
import { headers } from 'next/headers';

const g = globalThis as typeof globalThis & { __kkRate?: Map<string, { n: number; reset: number }> };
const buckets = (g.__kkRate ??= new Map());

/** Returns true if the action is allowed, false if the limit is reached. */
export function hit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n++;
  return b.n <= max;
}

/** Best-effort client address (behind a proxy, the first X-Forwarded-For entry). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local').trim();
}
