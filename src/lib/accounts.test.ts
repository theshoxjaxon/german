import { describe, expect, it } from 'vitest';
import { cleanDisplayName, initials, normalizeUsername, passwordError, safeNext, usernameError } from './account-rules';
import { answer } from './srs';
import { cardFlags, dayKey, diffActivity, lastDays, masteredAt, shiftDay, streakFrom } from './stats';
import type { CardDoc, LogEntry } from './types';

describe('account rules', () => {
  it('normalises and validates usernames', () => {
    expect(normalizeUsername('  Sardor_99 ')).toBe('sardor_99');
    expect(usernameError('sardor_99')).toBeNull();
    expect(usernameError('ab')).toMatch(/at least 3/);
    expect(usernameError('9lives')).toMatch(/Start with a letter/);
    expect(usernameError('has space')).toMatch(/letters, numbers/);
  });
  it('cleans names and checks passwords', () => {
    expect(cleanDisplayName('  Malika \u0007  Karimova ')).toBe('Malika Karimova');
    expect(passwordError('short')).toMatch(/8/);
    expect(passwordError('long enough')).toBeNull();
  });
  it('never redirects to another site after login', () => {
    expect(safeNext('/admin')).toBe('/admin');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
  it('makes initials', () => {
    expect(initials('Sardor Aliyev')).toBe('SA');
    expect(initials('malika')).toBe('M');
  });
});

describe('days and streaks', () => {
  it('uses the center’s time zone for the calendar day', () => {
    const t = Date.UTC(2026, 9, 12, 20, 30); // 20:30 UTC = 01:30 next day in Tashkent (UTC+5)
    expect(dayKey(t, 'UTC')).toBe('2026-10-12');
    expect(dayKey(t, 'Asia/Tashkent')).toBe('2026-10-13');
  });
  it('shifts across month ends', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(lastDays('2026-10-03', 3)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });
  it('counts a streak that is still alive from yesterday', () => {
    const days = new Set(['2026-10-10', '2026-10-11', '2026-10-12']);
    expect(streakFrom(days, '2026-10-12')).toBe(3);
    expect(streakFrom(days, '2026-10-13')).toBe(3); // not studied yet today: streak not lost
    expect(streakFrom(days, '2026-10-14')).toBe(0); // missed a day
  });
});

describe('activity from progress writes', () => {
  const t0 = Date.UTC(2026, 9, 12, 8);
  const s1 = answer(null, 'good', t0);
  const s2 = answer(s1, 'good', t0 + 600_000);
  const doc = (f: CardDoc['f']): CardDoc => ({ f, r: null, suspended: false, updatedAt: t0 });

  it('counts one answer per button press and a newly started card', () => {
    expect(diffActivity(null, doc(s1))).toEqual({ answers: 1, newCards: 1, reviews: 0, recalled: 0 });
    expect(diffActivity(doc(s1), doc(s2))).toEqual({ answers: 1, newCards: 0, reviews: 0, recalled: 0 });
  });
  it('counts nothing for an undo or a reset', () => {
    expect(diffActivity(doc(s2), doc(s1))).toEqual({ answers: 0, newCards: 0, reviews: 0, recalled: 0 });
    expect(diffActivity(doc(s2), null)).toEqual({ answers: 0, newCards: 0, reviews: 0, recalled: 0 });
  });
  it('caps inflated writes', () => {
    let s = s1;
    for (let i = 1; i < 10; i++) s = answer(s, 'again', t0 + i * 1000);
    expect(diffActivity(null, doc(s)).answers).toBe(2);
  });
  it('counts reviews and how many of them were remembered', () => {
    const rev = (log: LogEntry[]) => doc({ ...s2, type: 'review', ivl: 10, log });
    const before = rev([{ t: 1, r: 'good', k: 'review', i: 10 }]);
    const forgot = rev([{ t: 1, r: 'good', k: 'review', i: 10 }, { t: 2, r: 'again', k: 'review', i: 0 }]);
    const easy = rev([{ t: 1, r: 'good', k: 'review', i: 10 }, { t: 3, r: 'easy', k: 'review', i: 30 }]);
    expect(diffActivity(before, forgot)).toMatchObject({ answers: 1, reviews: 1, recalled: 0 });
    expect(diffActivity(before, easy)).toMatchObject({ answers: 1, reviews: 1, recalled: 1 });
    expect(diffActivity(doc(s1), doc(s2))).toMatchObject({ reviews: 0 }); // learning steps are not reviews
  });
  it('finds when a word was first mastered (a 21-day gap in either direction)', () => {
    expect(masteredAt(doc(s2))).toBeNull();
    const f = { ...s2, log: [{ t: 100, r: 'good' as const, k: 'review' as const, i: 8 }, { t: 200, r: 'good' as const, k: 'review' as const, i: 22 }, { t: 300, r: 'easy' as const, k: 'review' as const, i: 50 }] };
    const r = { ...s2, log: [{ t: 150, r: 'good' as const, k: 'review' as const, i: 21 }] };
    expect(masteredAt({ f, r: null, suspended: false, updatedAt: 0 })).toBe(200);
    expect(masteredAt({ f, r, suspended: false, updatedAt: 0 })).toBe(150);
  });
  it('flags started and mature words, ignoring paused ones', () => {
    expect(cardFlags(doc(s2))).toEqual({ started: 1, mature: 0 });
    expect(cardFlags({ ...doc(s2), suspended: true })).toEqual({ started: 0, mature: 0 });
    expect(cardFlags(doc({ ...s2, type: 'review', ivl: 30 }))).toEqual({ started: 1, mature: 1 });
  });
});
