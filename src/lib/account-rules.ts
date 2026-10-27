/** Rules for usernames, names and passwords. Pure functions, used by the server and the tests. */

export const USERNAME_RE = /^[a-z][a-z0-9_.]{2,19}$/;

/** "  Sardor_99 " → "sardor_99" */
export const normalizeUsername = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Collapse spaces and drop control characters. */
export const cleanDisplayName = (v: unknown) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function usernameError(username: string): string | null {
  if (!username) return 'Choose a username.';
  if (username.length < 3) return 'Use at least 3 characters.';
  if (username.length > 20) return 'Use at most 20 characters.';
  if (!USERNAME_RE.test(username)) return 'Start with a letter; then use letters, numbers, _ or . only.';
  return null;
}

export function displayNameError(name: string): string | null {
  if (!name) return 'Enter your name.';
  if (name.length > 40) return 'Use at most 40 characters.';
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  return null;
}

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

/** "k7m2-qx " → "K7M2QX": how people type the class code doesn't matter. */
export const normalizeJoinCode = (v: unknown) => String(v ?? '').toUpperCase().replace(/[\s-]/g, '');
