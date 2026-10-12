import { describe, expect, it } from 'vitest';
import { answer, nextEase, preview, SRS_DEFAULTS } from './srs';
import type { CardState, Rating } from './types';

const MIN = 60_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 12, 8);
const KEY = 'l3-familie:f';

describe('SM-2 ease formula', () => {
  it('matches EF + 0.1 − (5−q)(0.08 + (5−q)·0.02)', () => {
    expect(nextEase(2.5, 5)).toBe(2.6); // Easy  +0.10
    expect(nextEase(2.5, 4)).toBe(2.5); // Good  ±0
    expect(nextEase(2.5, 3)).toBe(2.36); // Hard  −0.14
    expect(nextEase(2.5, 2)).toBe(2.18); // Again −0.32
  });
  it('never drops below 1.3', () => {
    expect(nextEase(1.4, 2)).toBe(1.3);
  });
});

describe('new cards', () => {
  it('show the learning steps on the buttons', () => {
    const p = preview(null, T0, SRS_DEFAULTS, KEY);
    expect(p).toEqual({ again: 1 * MIN, hard: 5.5 * MIN, good: 10 * MIN, easy: 4 * DAY });
  });

  it('graduate to a 1-day interval after Good, Good', () => {
    let s = answer(null, 'good', T0, SRS_DEFAULTS, KEY);
    expect(s).toMatchObject({ type: 'learning', step: 1, first: T0 });
    s = answer(s, 'good', T0 + 10 * MIN, SRS_DEFAULTS, KEY);
    expect(s).toMatchObject({ type: 'review', ivl: 1, ease: 2.5 });
  });
});

describe('review cards', () => {
  it('grow by the ease factor on Good and keep the ease', () => {
    let s = answer(answer(null, 'good', T0, SRS_DEFAULTS, KEY), 'good', T0, SRS_DEFAULTS, KEY);
    const ivls = [s.ivl];
    for (let i = 0; i < 5; i++) {
      s = answer(s, 'good', s.due, SRS_DEFAULTS, KEY);
      ivls.push(s.ivl);
    }
    expect(ivls).toEqual([1, 4, 10, 24, 60, 144]);
    expect(s.ease).toBe(2.5);
  });

  it('always order the buttons Again < Hard < Good < Easy', () => {
    for (let ivl = 1; ivl < 400; ivl += 7) {
      for (const ease of [1.3, 1.9, 2.5, 3.1]) {
        const st: CardState = { type: 'review', step: 0, ivl, ease, reps: 3, lapses: 0, due: T0, first: T0, last: T0, log: [] };
        const p = preview(st, T0, SRS_DEFAULTS, `x${ivl}`);
        expect(p.again).toBeLessThan(p.hard);
        expect(p.hard).toBeLessThan(p.good);
        expect(p.good).toBeLessThan(p.easy);
      }
    }
  });

  it('lapse on Again: relearn in 10 min, half the interval, ease −0.32', () => {
    const st: CardState = { type: 'review', step: 0, ivl: 40, ease: 2.5, reps: 4, lapses: 0, due: T0, first: T0, last: T0, log: [] };
    const s = answer(st, 'again', T0, SRS_DEFAULTS, KEY);
    expect(s).toMatchObject({ type: 'relearning', ivl: 20, ease: 2.18, lapses: 1, due: T0 + 10 * MIN });
    expect(answer(s, 'good', T0 + 10 * MIN, SRS_DEFAULTS, KEY)).toMatchObject({ type: 'review', ivl: 20 });
  });
});

describe('engine properties', () => {
  it('preview() equals what answer() schedules (deterministic fuzz)', () => {
    const st: CardState = { type: 'review', step: 0, ivl: 17, ease: 2.3, reps: 5, lapses: 1, due: T0, first: T0, last: T0, log: [] };
    const p = preview(st, T0, SRS_DEFAULTS, KEY);
    for (const r of ['again', 'hard', 'good', 'easy'] as Rating[]) {
      expect(answer(st, r, T0, SRS_DEFAULTS, KEY).due - T0).toBe(p[r]);
    }
  });

  it('never mutates its input (stored snapshots can be frozen)', () => {
    const st = Object.freeze({ ...answer(null, 'good', T0), log: Object.freeze([]) as unknown as CardState['log'] });
    expect(() => answer(st, 'easy', T0)).not.toThrow();
  });

  it('keeps only the last 30 answers', () => {
    let s: CardState | null = null;
    for (let i = 0; i < 50; i++) s = answer(s, i % 3 ? 'good' : 'again', T0 + i * DAY);
    expect(s!.log).toHaveLength(30);
  });
});
