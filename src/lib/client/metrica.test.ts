import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanUrl, GOALS, isExcluded } from './metrica';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;
  delete (globalThis as { window?: unknown }).window;
  vi.resetModules();
});

describe('Yandex Metrica', () => {
  it('never sends query strings (reset links carry a secret), only campaign tags', () => {
    expect(cleanUrl('https://karteikasten.uz/reset-password?token=SECRET123')).toBe('https://karteikasten.uz/reset-password');
    expect(cleanUrl('https://karteikasten.uz/german?joined=email#study')).toBe('https://karteikasten.uz/german');
    expect(cleanUrl('https://karteikasten.uz/?utm_source=telegram&utm_campaign=quiz&x=1&from=share'))
      .toBe('https://karteikasten.uz/?utm_source=telegram&utm_campaign=quiz&from=share');
  });

  it('stays off admin, account and password pages', () => {
    for (const p of ['/admin', '/admin/analytics', '/account', '/reset-password', '/forgot-password']) expect(isExcluded(p)).toBe(true);
    for (const p of ['/', '/german', '/english', '/login', '/signup', '/s/abc', '/administrator-guide']) expect(isExcluded(p)).toBe(false);
  });

  it('does nothing without a counter id', async () => {
    const ym = vi.fn();
    (globalThis as { window?: unknown }).window = { ym };
    const m = await import('./metrica');
    m.goal('signup', { method: 'email' });
    m.hit('https://karteikasten.uz/german');
    expect(ym).not.toHaveBeenCalled();
  });

  it('sends goals, page views and visit parameters to the counter', async () => {
    process.env.NEXT_PUBLIC_YANDEX_METRICA_ID = '98765432';
    const ym = vi.fn();
    (globalThis as { window?: unknown }).window = { ym };
    const m = await import('./metrica');
    m.goal('test_done', { test: 'a11-modul-1', score: 21, max: 30 });
    m.hit('https://karteikasten.uz/german?joined=email', 'https://t.me/');
    m.visitParams({ course: 'german', signed_in: true });
    m.hit('https://karteikasten.uz/login', 'https://karteikasten.uz/reset-password?token=SECRET'); // the previous page, cleaned too
    expect(ym.mock.calls).toEqual([
      [98765432, 'reachGoal', 'test_done', { test: 'a11-modul-1', score: 21, max: 30 }],
      [98765432, 'hit', 'https://karteikasten.uz/german', { referer: 'https://t.me/' }],
      [98765432, 'params', { course: 'german', signed_in: true }],
      [98765432, 'hit', 'https://karteikasten.uz/login', { referer: 'https://karteikasten.uz/reset-password' }],
    ]);
  });

  it('documents every goal it can send', () => {
    expect(Object.keys(GOALS)).toEqual([
      'signup', 'course_pick', 'study_start', 'test_start', 'test_done', 'speaking_topic', 'gemini_open', 'share', 'telegram_connect', 'study_together_signup',
    ]);
  });
});
