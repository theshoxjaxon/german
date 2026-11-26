/**
 * Password hashing with scrypt (node:crypto). It runs in Node's thread pool, so checking a
 * password never freezes the server for other people; a pure-JavaScript bcrypt did, about 120 ms
 * per login, which capped one instance at ~8 logins a second and stalled everyone else meanwhile.
 *
 * The stored string `scrypt$N$r$p$salt$hash` carries its own salt and cost, so the cost can be raised
 * later without breaking existing accounts. Older accounts have a bcrypt hash ($2b$11$…): it
 * still verifies, and `needsRehash` tells the log-in to replace it with scrypt.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

// OWASP's scrypt setting (N=2^15, r=8, p=3): about 32 MB and 100-150 ms per check, off the main thread.
const N = 2 ** 15, R = 8, P = 3, KEY = 32;
const MAXMEM = 128 * N * R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, KEY, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** False when there is no password (a Google-only profile) or it doesn't match. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const pw = password.normalize('NFKC');
  if (stored.startsWith('$2')) {
    const { compare } = await import('bcryptjs'); // accounts made before scrypt; loaded only when one signs in
    return compare(pw, stored);
  }
  const [scheme, n, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const want = Buffer.from(key, 'base64url');
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64url'), want.length, { N: +n, r: +r, p: +p, maxmem: 128 * +n * +r * 2 });
  return timingSafeEqual(got, want);
}

/** True for a hash made by an older scheme: replace it after a successful log-in, while the password is in hand. */
export const needsRehash = (stored: string) => !stored.startsWith(`scrypt$${N}$${R}$${P}$`);

/** A hash of a random password, used to spend the same time when an email has no password to check. */
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, await dummy);
}

/** Readable temporary password for admin resets, e.g. "tante-fest-4821". */
const WORDS = ['tante', 'fest', 'oma', 'liste', 'mann', 'vater', 'sprache', 'karte', 'onkel', 'mutter', 'doch', 'nein', 'kind', 'buch', 'haus', 'stadt'];
export function temporaryPassword(): string {
  const b = randomBytes(4);
  return `${WORDS[b[0] % WORDS.length]}-${WORDS[b[1] % WORDS.length]}-${1000 + (b.readUInt16BE(2) % 9000)}`;
}
