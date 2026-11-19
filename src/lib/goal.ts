/**
 * The daily goal and the streak on the home screen. Today's answers come from each card's
 * answer log (its last 30 answers), so the goal ring moves the moment you answer, signed in or not.
 */
import { dayIndex } from './time';
import type { CardDoc } from './types';

/** What the server knows: days in a row up to today (or yesterday), and whether today counts yet. */
export interface ServerStreak {
  days: number;
  studiedToday: boolean;
}

function* answerTimes(cards: Iterable<CardDoc>): Generator<number> {
  for (const doc of cards) {
    for (const s of [doc.f, doc.r]) for (const e of s?.log ?? []) yield e.t;
  }
}

/** Answers given today (study days start at 04:00, like everywhere in the app). */
export function answersToday(cards: Iterable<CardDoc>, now: number): number {
  const today = dayIndex(now);
  let n = 0;
  for (const t of answerTimes(cards)) if (dayIndex(t) === today) n++;
  return n;
}

/** Days in a row with an answer, up to today; if you haven't studied yet today, up to yesterday. */
export function streakOf(cards: Iterable<CardDoc>, now: number): number {
  const days = new Set<number>();
  for (const t of answerTimes(cards)) days.add(dayIndex(t));
  let day = dayIndex(now);
  if (!days.has(day)) day--;
  let n = 0;
  while (days.has(day)) {
    n++;
    day--;
  }
  return n;
}

/**
 * The streak to show. Signed in: the server's count (right across all your devices), plus today
 * once you've answered something it didn't know about yet. Guests: this device's own history.
 */
export function shownStreak(server: ServerStreak | null, cards: Iterable<CardDoc>, now: number): number {
  if (!server) return streakOf(cards, now);
  return server.days + (!server.studiedToday && answersToday(cards, now) > 0 ? 1 : 0);
}
