import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUrl, passwordEmail, sendPasswordEmail } from './mail';

const input = { to: 'malika@example.com', name: 'Malika <b>K</b>', link: 'https://kk.example/reset-password?token=abc_123', lang: 'en' as const, purpose: 'reset' as const };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('password emails', () => {
  it('sends through Resend with the key, the sender and the link', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubEnv('EMAIL_FROM', 'Karteikasten <hello@kk.example>');
    const fetch = vi.fn(async () => new Response('{"id":"1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await sendPasswordEmail(input)).toBe(true);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_123');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: 'Karteikasten <hello@kk.example>', to: ['malika@example.com'], subject: 'Reset your Karteikasten password' });
    expect(body.text).toContain(input.link);
    expect(body.html).toContain('href="https://kk.example/reset-password?token=abc_123"');
    expect(body.html).toContain('Malika &#60;b&#62;K&#60;/b&#62;'); // names are escaped
    expect(body.html).not.toContain('<b>K</b>');
  });

  it('reports a refused email without throwing', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_123');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"domain not verified"}', { status: 403 })));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendPasswordEmail(input)).toBe(false);
    expect(error.mock.calls[0][0]).toMatch(/Resend refused/);
  });

  it('prints the link in development when there is no key, and never in production', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'development');
    expect(await sendPasswordEmail(input)).toBe(false);
    expect(log.mock.calls[0][0]).toContain(input.link);
    vi.stubEnv('NODE_ENV', 'production');
    await sendPasswordEmail(input);
    expect(error.mock.calls[0][0]).toMatch(/RESEND_API_KEY/);
    expect(JSON.stringify(error.mock.calls)).not.toContain('token=');
  });

  it('is written in Uzbek too, and for setting a first password', () => {
    expect(passwordEmail('Sardor', input.link, 'uz', 'reset').subject).toBe('Karteikasten parolingizni tiklang');
    const set = passwordEmail('Sardor', input.link, 'en', 'set');
    expect(set.subject).toBe('Set a password for Karteikasten');
    expect(set.text).toMatch(/works once, for 45 minutes/);
  });

  it('builds links from APP_URL', async () => {
    vi.stubEnv('APP_URL', 'https://german-roan.vercel.app/');
    expect(await appUrl()).toBe('https://german-roan.vercel.app');
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'german-roan.vercel.app');
    expect(await appUrl()).toBe('https://german-roan.vercel.app');
  });
});
