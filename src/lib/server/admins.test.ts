import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminEmail } from './admins';

afterEach(() => vi.unstubAllEnvs());

describe('ADMIN_EMAILS', () => {
  it('matches however the list is pasted: case, spaces, commas, semicolons, quotes', () => {
    vi.stubEnv('ADMIN_EMAILS', ' "Teacher@Markaz.uz", second@markaz.uz;  <third@markaz.uz> ');
    expect(isAdminEmail('teacher@markaz.uz')).toBe(true);
    expect(isAdminEmail('SECOND@markaz.uz')).toBe(true);
    expect(isAdminEmail('third@markaz.uz')).toBe(true);
    expect(isAdminEmail('student@markaz.uz')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });

  it('matches nobody when the list is empty', () => {
    vi.stubEnv('ADMIN_EMAILS', '');
    expect(isAdminEmail('teacher@markaz.uz')).toBe(false);
  });
});
