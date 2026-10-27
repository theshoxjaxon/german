import { describe, expect, it } from 'vitest';
import { DbConfigError, parseDatabaseUrl } from './db';
import { describeDbError } from './db-health';

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

describe('DATABASE_URL paste mistakes', () => {
  const url = 'postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
  it('forgives quotes and a leading DATABASE_URL=', () => {
    for (const raw of [`"${url}"`, `'${url}'`, `DATABASE_URL=${url}`, `DATABASE_URL="${url}"`, `  ${url}\n`]) {
      expect(parseDatabaseUrl(raw).hostname).toBe('aws-0-eu-central-1.pooler.supabase.com');
    }
  });
  it('spots the [YOUR-PASSWORD] placeholder', () => {
    expect(() => parseDatabaseUrl('postgresql://postgres.abc:[YOUR-PASSWORD]@host:6543/postgres')).toThrow(/still contains \[YOUR-PASSWORD\]/);
  });
});

describe('explaining database failures', () => {
  const err = (code: string, message = '') => Object.assign(new Error(message), { code });
  it('turns each failure into advice, never echoing the URL', () => {
    const cases: [unknown, string][] = [
      [new DbConfigError('missing', 'DATABASE_URL is not set'), 'missing'],
      [err('28P01', 'password authentication failed for user "postgres"'), 'password'],
      [err('XX000', 'Tenant or user not found'), 'project'],
      [err('ENOTFOUND', 'getaddrinfo ENOTFOUND db.example.supabase.co'), 'host'],
      [err('ENETUNREACH', 'connect ENETUNREACH 2a05::1:5432'), 'network'],
      [err('ECONNREFUSED'), 'refused'],
      [new Error('Connection terminated due to connection timeout'), 'timeout'],
      [err('3D000', 'database "x" does not exist'), 'database'],
      [new Error('self-signed certificate in certificate chain'), 'tls'],
      [new Error('something else'), 'unknown'],
    ];
    for (const [e, problem] of cases) expect(describeDbError(e).problem).toBe(problem);
    expect(describeDbError(err('ENOTFOUND', 'getaddrinfo ENOTFOUND db.example.supabase.co')).message).not.toContain('db.example');
  });
});
