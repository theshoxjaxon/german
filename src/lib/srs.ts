/**
 * Spaced-repetition engine: the SM-2 ease formula plus Anki-style learning steps.
 * Pure functions only (no DOM, no storage), so it is easy to test.
 */
import type { CardState, Rating } from './types';

const MIN = 60_000;
const DAY = 86_400_000;

/** Each button maps to an SM-2 quality grade q (0–5). q < 3 is a failed recall. */
export const QUALITY: Record<Rating, number> = { again: 2, hard: 3, good: 4, easy: 5 };

export interface SrsConfig {
  learnSteps: number[]; // minutes between first sightings of a new card
  relearnSteps: number[]; // minutes before a forgotten card is retried
  graduatingIvl: number; // days, first interval after the learning steps
  easyIvl: number; // days, when a new card is marked Easy
  startEase: number; // SM-2 starting E-Factor
  minEase: number; // SM-2 floor
  hardFactor: number; // Hard grows the interval by 20% only
  easyBonus: number; // Easy grows it by an extra 30%
  lapseFactor: number; // a forgotten card keeps half its interval
  maxIvl: number;
}

export const SRS_DEFAULTS: SrsConfig = {
  learnSteps: [1, 10],
  relearnSteps: [10],
  graduatingIvl: 1,
  easyIvl: 4,
  startEase: 2.5,
  minEase: 1.3,
  hardFactor: 1.2,
  easyBonus: 1.3,
  lapseFactor: 0.5,
  maxIvl: 36_500,
};

/**
 * SM-2: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), never below 1.3
 * q=5 → +0.10, q=4 → ±0, q=3 → -0.14, q=2 → -0.32
 */
export function nextEase(ease: number, q: number, minEase = SRS_DEFAULTS.minEase): number {
  const d = 5 - q;
  return Math.max(minEase, Math.round((ease + 0.1 - d * (0.08 + d * 0.02)) * 100) / 100);
}

/** FNV-1a: a tiny deterministic string hash. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Spread words learned on the same day over neighbouring days. Seeded, so the
 * interval shown on a button is exactly the interval you get.
 */
function fuzz(ivl: number, seed: number): number {
  if (ivl < 3) return ivl;
  const spread = Math.max(1, Math.round(ivl * 0.05));
  return ivl - spread + (seed % (2 * spread + 1));
}

export function blankCard(cfg: SrsConfig = SRS_DEFAULTS): CardState {
  return { type: 'new', step: 0, due: 0, ivl: 0, ease: cfg.startEase, reps: 0, lapses: 0, first: 0, last: 0, log: [] };
}

function stepsFor(s: CardState, cfg: SrsConfig): number[] {
  const steps = s.type === 'relearning' ? cfg.relearnSteps : cfg.learnSteps;
  return Array.isArray(steps) && steps.length ? steps : [1];
}

function hardDelay(steps: number[], step: number): number {
  if (step === 0 && steps.length > 1) return (steps[0] + steps[1]) / 2;
  if (steps.length === 1) return Math.min(steps[0] * 1.5, steps[0] + 1440);
  return steps[step];
}

/** Next interval in days for each passing button, from the current interval and ease. */
export function reviewIntervals(s: CardState, cfg: SrsConfig, seed: number): Record<'hard' | 'good' | 'easy', number> {
  const ivl = Math.max(1, s.ivl);
  const cap = (v: number) => Math.min(cfg.maxIvl, v);
  const hard = cap(Math.max(ivl + 1, fuzz(Math.round(ivl * cfg.hardFactor), seed)));
  const good = cap(Math.max(hard + 1, fuzz(Math.round(ivl * s.ease), seed)));
  const easy = cap(Math.max(good + 1, fuzz(Math.round(ivl * s.ease * cfg.easyBonus), seed)));
  return { hard, good, easy };
}

/**
 * Apply one answer. `prev` is the card's state, or null if it was never seen.
 * Returns a NEW state; `prev` is never mutated.
 */
export function answer(prev: CardState | null, rating: Rating, now: number, cfg: SrsConfig = SRS_DEFAULTS, key = ''): CardState {
  const s: CardState = prev ? { ...prev, log: (prev.log || []).slice() } : blankCard(cfg);
  const kind = s.type;
  if (s.type === 'new') {
    s.type = 'learning';
    s.step = 0;
    s.first = now;
  }

  if (s.type === 'learning' || s.type === 'relearning') {
    // Short-term phase: steps measured in minutes; ease is not touched.
    const steps = stepsFor(s, cfg);
    const learning = s.type === 'learning';
    if (rating === 'again') {
      s.step = 0;
      s.due = now + steps[0] * MIN;
    } else if (rating === 'hard') {
      s.step = Math.min(s.step, steps.length - 1);
      s.due = now + hardDelay(steps, s.step) * MIN;
    } else if (rating === 'good' && s.step + 1 < steps.length) {
      s.step += 1;
      s.due = now + steps[s.step] * MIN;
    } else {
      // Graduate to day-based reviews.
      const ivl = rating === 'easy' ? (learning ? cfg.easyIvl : s.ivl + 1) : learning ? cfg.graduatingIvl : s.ivl;
      s.type = 'review';
      s.step = 0;
      s.ivl = Math.max(1, Math.round(ivl));
      s.reps += 1;
      s.due = now + s.ivl * DAY;
    }
  } else {
    // Long-term phase: SM-2. The interval grows by the OLD ease, then the ease is updated.
    const q = QUALITY[rating];
    if (rating === 'again') {
      s.lapses += 1;
      s.ivl = Math.max(1, Math.round(s.ivl * cfg.lapseFactor));
      s.type = 'relearning';
      s.step = 0;
      s.due = now + stepsFor(s, cfg)[0] * MIN;
    } else {
      s.ivl = reviewIntervals(s, cfg, hash(`${key}:${s.reps}`))[rating];
      s.reps += 1;
      s.due = now + s.ivl * DAY;
    }
    s.ease = nextEase(s.ease, q, cfg.minEase);
  }

  s.last = now;
  s.log.push({ t: now, r: rating, k: kind, i: s.type === 'review' ? s.ivl : 0 });
  if (s.log.length > 30) s.log = s.log.slice(-30);
  return s;
}

/** How long until the card comes back for each button (shown on the buttons). */
export function preview(prev: CardState | null, now: number, cfg: SrsConfig = SRS_DEFAULTS, key = ''): Record<Rating, number> {
  return {
    again: answer(prev, 'again', now, cfg, key).due - now,
    hard: answer(prev, 'hard', now, cfg, key).due - now,
    good: answer(prev, 'good', now, cfg, key).due - now,
    easy: answer(prev, 'easy', now, cfg, key).due - now,
  };
}
