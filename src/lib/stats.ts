/**
 * Pure helpers for activity, streaks and dashboards. Shared by the server and the tests.
 *
 * Days are calendar dates in the learning center's time zone (APP_TIMEZONE, default
 * Asia/Tashkent), written as 'YYYY-MM-DD' strings so they sort and compare as text.
 */
import type { CardDoc, CardState } from './types';

export const DEFAULT_TIMEZONE = 'Asia/Tashkent';

export function safeTimeZone(tz: string | undefined): string {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz || DEFAULT_TIMEZONE });
    return tz || DEFAULT_TIMEZONE;
  } catch {
    return 'UTC';
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** 1760252400000 → '2026-10-12' in the given time zone. */
export function dayKey(t: number, timeZone: string): string {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, f);
  }
  return f.format(new Date(t));
}

/** '2026-10-12', -1 → '2026-10-11' */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** The last `n` days ending with `today`, oldest first. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDay(today, i - (n - 1)));
}

/**
 * Days in a row with at least one answer. Today counts if you studied today; if you have not
 * studied yet today, a streak that ran until yesterday is still alive.
 */
export function streakFrom(studyDays: Set<string>, today: string): number {
  let day = studyDays.has(today) ? today : shiftDay(today, -1);
  let n = 0;
  while (studyDays.has(day)) {
    n++;
    day = shiftDay(day, -1);
  }
  return n;
}

const started = (s: CardState | null | undefined) => !!s && s.type !== 'new';
const lastT = (s: CardState | null | undefined) => (s?.log?.length ? s.log[s.log.length - 1].t : 0);

/**
 * How many new answers and newly started cards a progress write contains, by comparing the
 * stored doc with the incoming one. An undo writes an older doc, which counts as 0.
 */
export function diffActivity(prev: CardDoc | null, next: CardDoc | null): { answers: number; newCards: number } {
  let answers = 0;
  let newCards = 0;
  for (const dir of ['f', 'r'] as const) {
    const a = prev?.[dir];
    const b = next?.[dir];
    if (!b) continue;
    const since = lastT(a);
    answers += (b.log || []).filter((e) => e.t > since).length;
    if (!started(a) && started(b)) newCards++;
  }
  // One write is one button press; anything larger is not a real study session.
  return { answers: Math.min(answers, 2), newCards: Math.min(newCards, 2) };
}

/** Flags stored next to each progress row so leaderboards need no JSON parsing. */
export function cardFlags(doc: CardDoc | null): { started: 0 | 1; mature: 0 | 1 } {
  if (!doc || doc.suspended) return { started: 0, mature: 0 };
  const states = [doc.f, doc.r];
  return {
    started: states.some(started) ? 1 : 0,
    mature: states.some((s) => s?.type === 'review' && s.ivl >= 21) ? 1 : 0,
  };
}

/*
 * Fixed-format date labels. Intl output differs between Node and browsers (different CLDR
 * versions: "Tue 13 Oct" vs "Tue, 13 Oct"), which breaks hydration for server-rendered text.
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_DE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const parts = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  return { wd: d.getUTCDay(), dd: d.getUTCDate(), mm: d.getUTCMonth(), yy: d.getUTCFullYear() };
};
/** '2026-10-13' → 'Tue 13 Oct' */
export const dayLabelLong = (day: string) => {
  const p = parts(day);
  return `${WEEKDAYS[p.wd]} ${p.dd} ${MONTHS[p.mm]}`;
};
/** '2026-10-13' → '13. Okt.' (German short form, for chart axes) */
export const dayLabelShortDe = (day: string) => {
  const p = parts(day);
  return `${p.dd}. ${MONTHS_DE[p.mm]}`;
};
/** '2026-10-13' → '13 Oct 2026' */
export const dayLabelWithYear = (day: string) => {
  const p = parts(day);
  return `${p.dd} ${MONTHS[p.mm]} ${p.yy}`;
};
