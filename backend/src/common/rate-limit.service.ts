import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Database } from '@api/database/database.service';
import { RequestContext } from './request-context.service';

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

/**
 * Rate limits kept in the database, so they hold across every server instance (Vercel runs
 * many, and each starts empty). A fixed window per key: the first hit opens it, and after `max`
 * hits the action is refused until the window ends. Keys are stored as SHA-256 hashes, so no
 * email address or IP address is kept in plain text.
 */
@Injectable()
export class RateLimiter {
  constructor(private readonly database: Database, private readonly ctx: RequestContext) {}

  /** Count one attempt. True if it is allowed, false once the limit is reached. One round trip. */
  async hit(key: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
    const db = await this.database.get();
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

  /** Count one attempt for this client's address: `scope:ip` is the usual key. */
  hitIp(scope: string, max: number, windowMs: number): Promise<boolean> {
    return this.hit(`${scope}:${this.ctx.clientIp()}`, max, windowMs);
  }
}
