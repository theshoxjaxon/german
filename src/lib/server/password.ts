/**
 * Password hashing with scrypt (built into Node, no extra dependency).
 *
 * Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
 * Keeping the parameters in the string means they can be raised later without
 * breaking existing accounts.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))));

const N = 2 ** 15; // CPU/memory cost: ~32 MB and ~50 ms per hash
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
  });
  // Constant-time comparison, so response timing reveals nothing about the hash.
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash of a random password, used to spend the same time when a username does not exist. */
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
