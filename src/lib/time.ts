export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
/** A study day starts at 04:00 local time, like Anki, so late-night study counts for the day before. */
export const ROLLOVER_HOUR = 4;

/** Number of the study day that contains timestamp t (local time, 04:00 rollover). */
export function dayIndex(t: number): number {
  return Math.floor((t - new Date(t).getTimezoneOffset() * MIN - ROLLOVER_HOUR * HOUR) / DAY);
}

/** A Date inside study day `idx`. Read it with timeZone: 'UTC' to get that day's local calendar date. */
export function dayDate(idx: number): Date {
  return new Date(idx * DAY + (ROLLOVER_HOUR + 12) * HOUR);
}

const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });
const fmtDayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtToday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** German two-letter weekday: Mo, Di, Mi … */
export const weekday = (idx: number) => fmtWeekday.format(dayDate(idx)).replace(/\.$/, '');
export const dayLong = (idx: number) => fmtDayLong.format(dayDate(idx));
export const studyDayTitle = (now: number) => fmtToday.format(dayDate(dayIndex(now)));
export const shortDate = (t: number) => fmtShort.format(new Date(t));

const trim1 = (n: number) => n.toFixed(1).replace(/\.0$/, '');

/** 45000 → "<1m", 600000 → "10m", 4 days → "4d", 70 days → "2.3mo" */
export function fmtSpan(ms: number): string {
  const m = ms / MIN;
  if (m < 1) return '<1m';
  if (m < 60) return Math.round(m) + 'm';
  if (m < 1440) return Math.round(m / 60) + 'h';
  const d = ms / DAY;
  if (d < 30) return Math.round(d) + 'd';
  if (d < 365) return trim1(d / 30) + 'mo';
  return trim1(d / 365) + 'y';
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
