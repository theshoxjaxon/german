/**
 * Password hashing with bcrypt (bcryptjs: plain JavaScript, so it runs anywhere Node does).
 *
 * The stored string ($2b$11$…) carries its own salt and cost, so the cost can be raised later
 * without breaking existing accounts. bcrypt reads only the first 72 bytes of a password;
 * longer ones are refused when they're chosen (auth-schemas.ts) instead of silently cut.
 */
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const COST = 11; // about 150 ms per hash on a server: slow for a guesser, unnoticeable for a person

export async function hashPassword(password: string): Promise<string> {
  return hash(password.normalize('NFKC'), COST);
}

/** False when there is no password (a Google-only profile) or it doesn't match. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored?.startsWith('$2')) return false;
  return compare(password.normalize('NFKC'), stored);
}

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
