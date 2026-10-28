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
export function safeNext(v: unknown): string {
  const s = String(v ?? '');
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : '/';
}

/** "Sardor Aliyev" → "SA", "malika" → "M" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
