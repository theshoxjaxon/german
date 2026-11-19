/**
 * Weeks and hours for "Let's study together". Pure, shared by the server, the browser and tests.
 *
 *   week  the Monday of a week, 'YYYY-MM-DD', in the learning center's time zone (APP_TIMEZONE)
 *   slot  one hour of that week: day × 24 + hour, day 0 = Monday … 6 = Sunday, hours 8–21
 *         (a slot is "from hour:00 to hour+1:00"; the grid runs 8:00–22:00)
 *
 * Sign-ups for a week close the Sunday before it at 18:00; then the groups are made.
 */
import { dayKey, shiftDay } from '../stats';
import { HOUR } from '../time';

export const FIRST_HOUR = 8;
export const LAST_HOUR = 21; // the last slot starts at 21:00
export const DEADLINE_HOUR = 18; // Sunday before the week
export const DAYS = 7;
/** Every slot of a week, in order. */
export const ALL_SLOTS: readonly number[] = Array.from({ length: DAYS }, (_, d) =>
  Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, h) => d * 24 + FIRST_HOUR + h),
).flat();

export const slotDay = (slot: number) => Math.floor(slot / 24);
export const slotHour = (slot: number) => slot % 24;
export const isSlot = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && slotDay(v as number) < DAYS && slotHour(v as number) >= FIRST_HOUR && slotHour(v as number) <= LAST_HOUR;

/** Day of the week of '2026-11-02': 0 = Monday … 6 = Sunday. */
export function weekdayOf(day: string): number {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}

const parts = new Map<string, Intl.DateTimeFormat>();
/** How far `timeZone` is ahead of UTC at instant `t`, in ms (Tashkent: +5 h). */
function offsetAt(t: number, timeZone: string): number {
  let f = parts.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    parts.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** The instant of `hour`:00 on `day` in `timeZone` (works across daylight-saving changes too). */
export function localTime(day: string, hour: number, timeZone: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  const first = guess - offsetAt(guess, timeZone);
  return guess - offsetAt(first, timeZone);
}

/** The week (its Monday) that instant `t` falls in. */
export function weekOf(t: number, timeZone: string): string {
  const day = dayKey(t, timeZone);
  return shiftDay(day, -weekdayOf(day));
}

/** When sign-ups for `week` close: the Sunday before, 18:00. */
export const deadline = (week: string, timeZone: string) => localTime(shiftDay(week, -1), DEADLINE_HOUR, timeZone);
/** When `week` is over: the next Monday, 0:00. */
export const weekEnd = (week: string, timeZone: string) => localTime(shiftDay(week, DAYS), 0, timeZone);
/** When the hour `slot` of `week` starts. */
export const slotStart = (week: string, slot: number, timeZone: string) =>
  localTime(shiftDay(week, slotDay(slot)), slotHour(slot), timeZone);

/** The week people sign up for at `now`: next week, or the one after once Sunday 18:00 has passed. */
export function signupWeek(now: number, timeZone: string): string {
  const next = shiftDay(weekOf(now, timeZone), DAYS);
  return now < deadline(next, timeZone) ? next : shiftDay(next, DAYS);
}

/** The latest week whose sign-ups have closed, so its groups are due: next week after Sunday 18:00, else this week. */
export function dueWeek(now: number, timeZone: string): string {
  const next = shiftDay(weekOf(now, timeZone), DAYS);
  return now >= deadline(next, timeZone) ? next : weekOf(now, timeZone);
}

/** Groups and their chats are deleted this long after their week ends. */
export const KEEP_AFTER_WEEK = 14 * 24 * HOUR;

/** 'Asia/Tashkent' → 'Tashkent', for "times are in Tashkent time". */
export const cityOf = (timeZone: string) => (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');
