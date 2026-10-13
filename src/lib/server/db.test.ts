import { describe, expect, it } from 'vitest';
import { parseDatabaseUrl } from './db';

describe('DATABASE_URL', () => {
  const host = 'aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

  it('reads a normal connection string', () => {
    const u = parseDatabaseUrl(`postgresql://postgres.abc:simplePass123@${host}`);
    expect([u.username, u.password, u.hostname, u.port]).toEqual(['postgres.abc', 'simplePass123', 'aws-0-eu-central-1.pooler.supabase.com', '6543']);
  });

  it('encodes a password with URL characters instead of failing', () => {
    const password = 'Ab+1#c%d@e/f?g';
    const u = parseDatabaseUrl(`postgresql://postgres.abc:${password}@${host}?pgbouncer=true`);
    expect(decodeURIComponent(u.password)).toBe(password);
    expect(u.hostname).toBe('aws-0-eu-central-1.pooler.supabase.com');
    expect(u.pathname).toBe('/postgres');
    expect(u.searchParams.get('pgbouncer')).toBe('true');
  });

  it('never repeats the connection string (or password) in its error', () => {
    const secret = 'not a url with s3cret';
    expect(() => parseDatabaseUrl(secret)).toThrow(/not a valid connection string/);
    try {
      parseDatabaseUrl(secret);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('s3cret');
    }
  });
});
