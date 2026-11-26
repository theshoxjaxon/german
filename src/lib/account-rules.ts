/** Small rules for accounts. Pure functions, used by the server, the forms and the tests. */

/** "  Malika@Example.COM " → "malika@example.com": one address, however it is typed. */
export const normalizeEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Collapse spaces and drop control characters. */
export const cleanDisplayName = (v: unknown) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** bcrypt reads only the first 72 bytes of a password, so longer ones are refused, not silently cut. */
export const PASSWORD_MAX_BYTES = 72;
export const passwordBytes = (password: string) => new TextEncoder().encode(password.normalize('NFKC')).length;

/** Only allow redirects to paths on this site ("/admin"), never "//evil.com" or "https://…". */
/** Where to go after logging in: a path on this site, else (and for the welcome page) your course. */
export function safeNext(v: unknown): string {
  const s = String(v ?? '');
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') && s !== '/' ? s : '/app';
}

/** "Sardor Aliyev" → "SA", "malika" → "M" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * Sign-up takes real Gmail addresses only, which also keeps out temporary-mail services. A Gmail
 * name is 6–30 letters, digits and dots, starting and ending with a letter or digit, no "..".
 * "+tag" aliases are refused too (one mailbox, many profiles). googlemail.com is the same
 * mailbox as gmail.com and is stored as gmail.com.
 */
const GMAIL = /^(?=.{6,30}@)[a-z0-9](?:[a-z0-9]|\.(?!\.))*[a-z0-9]@(?:gmail|googlemail)\.com$/;
export const isRealGmail = (email: string) => GMAIL.test(email);
export const canonicalGmail = (email: string) => email.replace(/@googlemail\.com$/, '@gmail.com');

/** Passwords people (and bots) try first. Eight characters long is not enough if it is on this list. */
const COMMON_PASSWORDS = new Set(
  '12345678 123456789 1234567890 11111111 00000000 87654321 password password1 password123 passw0rd qwertyui qwerty123 qwertyuiop 1q2w3e4r 1q2w3e4r5t iloveyou admin123 welcome1 letmein1 abc12345 abcd1234 asdfghjk asdf1234 zaq12wsx monkey123 dragon123 football1 sunshine1 uzbekistan deutsch123 karteikasten'.split(' '),
);
/** True when a new password is too easy to guess: a famous one, one repeated character, or the email name. */
export const isWeakPassword = (password: string, email = '') => {
  const p = password.normalize('NFKC').toLowerCase();
  const name = email.split('@')[0].toLowerCase();
  return COMMON_PASSWORDS.has(p) || /^(.)\1+$/.test(p) || (name.length >= 4 && p.includes(name));
};
