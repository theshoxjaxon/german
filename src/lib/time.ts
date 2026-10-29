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

/*
 * Study-page dates are in the language studied ('de-DE' by default: "Mo", "Donnerstag, 29. Oktober";
 * 'en-GB': "Mon", "Thursday 29 October"). One formatter per locale and style, made on first use.
 */
const formats = new Map<string, Intl.DateTimeFormat>();
const STYLES = {
  weekday: { weekday: 'short' },
  long: { weekday: 'short', day: 'numeric', month: 'short' },
  today: { weekday: 'long', day: 'numeric', month: 'long' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;
function fmt(locale: string, style: keyof typeof STYLES): Intl.DateTimeFormat {
  const key = `${locale} ${style}`;
  let f = formats.get(key);
  if (!f) formats.set(key, (f = new Intl.DateTimeFormat(locale, { ...STYLES[style], timeZone: 'UTC' })));
  return f;
}
const fmtShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** Short weekday: Mo, Di, Mi … (German) or Mon, Tue … (English) */
export const weekday = (idx: number, locale = 'de-DE') => fmt(locale, 'weekday').format(dayDate(idx)).replace(/\.$/, '');
export const dayLong = (idx: number, locale = 'de-DE') => fmt(locale, 'long').format(dayDate(idx));
export const studyDayTitle = (now: number, locale = 'de-DE') => fmt(locale, 'today').format(dayDate(dayIndex(now)));
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
