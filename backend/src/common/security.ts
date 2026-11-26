import type { NextFunction, Request, Response } from 'express';

/** Headers every API answer carries: no sniffing, no framing, no referrer, HTTPS only. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.removeHeader('X-Powered-By');
  next();
}

/**
 * A coarse flood limit per client address, kept in memory (cheap: no database trip per request).
 * The sign-in limits that matter stay in the database (RateLimiter); this only stops a client
 * hammering any endpoint. ponytail: per instance, so the real ceiling is limit x instances;
 * move to the database or Redis if one address must be capped globally.
 */
export function floodLimit(max = 300, windowMs = 60_000) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    const key = req.ip ?? 'local';
    const h = hits.get(key);
    if (!h || h.reset <= now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++h.n > max) {
      res.setHeader('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      res.status(429).json({ error: 'Too many requests. Slow down and try again in a minute.' });
      return;
    }
    next();
  };
}
