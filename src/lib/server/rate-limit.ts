/**
 * Rate limits kept in the database, so they hold across every server instance (Vercel runs
 * many, and each starts empty). A fixed window per key: the first hit opens it, and after `max`
 * hits the action is refused until the window ends. Keys are stored as SHA-256 hashes, so no
 * email address or IP address is kept in plain text.
 */
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { getDb } from './db';

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Count one attempt. True if it is allowed, false once the limit is reached. One round trip. */
export async function hit(key: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<{ hits: number }>(
    `INSERT INTO rate_limits (key, hits, reset_at) VALUES ($1, 1, $3)
     ON CONFLICT (key) DO UPDATE SET
       hits     = CASE WHEN rate_limits.reset_at <= $2 THEN 1 ELSE rate_limits.hits + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= $2 THEN excluded.reset_at ELSE rate_limits.reset_at END
     RETURNING hits`,
    [hashKey(key), now, now + windowMs],
  );
  // Housekeeping now and then: windows that are over count for nothing
  if (Math.random() < 0.02) await db.query('DELETE FROM rate_limits WHERE reset_at <= $1', [now]);
  return Number(r.rows[0]?.hits ?? 1) <= max;
}

/** Best-effort client address (behind a proxy, the first X-Forwarded-For entry). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local').trim();
}
