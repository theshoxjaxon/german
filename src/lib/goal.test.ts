import { describe, expect, it } from 'vitest';
import { answersToday, shownStreak, streakOf } from './goal';
import { DAY, HOUR } from './time';
import type { CardDoc, LogEntry } from './types';

// Noon local time on some day, so ±hours never cross the 04:00 rollover by accident
const NOON = new Date(2026, 9, 27, 12, 0, 0).getTime();
const card = (...times: number[]): CardDoc => ({
  f: { type: 'review', step: 0, due: 0, ivl: 1, ease: 2.5, reps: times.length, lapses: 0, first: times[0] ?? 0, last: times.at(-1) ?? 0,
    log: times.map((t): LogEntry => ({ t, r: 'good', k: 'review', i: 1 })) },
  r: null,
  suspended: false,
  updatedAt: 0,
});

describe('daily goal and streak', () => {
  it('counts today’s answers across cards, with the day starting at 04:00', () => {
    const cards = [card(NOON - HOUR, NOON - 2 * DAY), card(NOON - 30 * 60_000)];
    expect(answersToday(cards, NOON)).toBe(2);
    const at3am = new Date(2026, 9, 28, 3, 0, 0).getTime(); // still "yesterday's" study day
    expect(answersToday(cards, at3am)).toBe(2);
  });

  it('counts days in a row, and keeps a streak alive until you study today', () => {
    const cards = [card(NOON - DAY, NOON - 2 * DAY), card(NOON - 3 * DAY, NOON - 5 * DAY)];
    expect(streakOf(cards, NOON)).toBe(3); // yesterday, 2 and 3 days ago; 4 days ago is a gap
    expect(streakOf([...cards, card(NOON)], NOON)).toBe(4);
    expect(streakOf(cards, NOON + DAY)).toBe(0); // missed yesterday
  });

  it('adds today to the server’s streak once you’ve studied today', () => {
    const today = [card(NOON)];
    expect(shownStreak({ days: 5, studiedToday: false }, today, NOON)).toBe(6);
    expect(shownStreak({ days: 5, studiedToday: true }, today, NOON)).toBe(5); // already counted
    expect(shownStreak({ days: 5, studiedToday: false }, [], NOON)).toBe(5);
    expect(shownStreak(null, [card(NOON, NOON - DAY)], NOON)).toBe(2); // guests: this device
  });
});
