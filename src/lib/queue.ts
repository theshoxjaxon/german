/**
 * Derived data: which card to study next, today's counts, per-word status and the stats page.
 * Everything here is a pure function of (words, cards, prefs, now).
 */
import { SRS_DEFAULTS, type SrsConfig } from './srs';
import { genderOf, type Article } from './text';
import { dayIndex } from './time';
import type { CardDoc, CardState, Dir, Prefs, StudyData, Word } from './types';

export const LEECH_AT = 4; // lapses before a word is flagged as a leech
export const LEARN_AHEAD = 20 * 60_000; // when nothing else is left, show learning cards up to 20 min early

const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
export const compareText = (a: string, b: string) => collator.compare(a, b);

export const srsConfig = (prefs: Prefs): SrsConfig => ({
  ...SRS_DEFAULTS,
  learnSteps: prefs.learnSteps,
  relearnSteps: prefs.relearnSteps,
});

export function enabledDirs(prefs: Prefs): Dir[] {
  const d: Dir[] = [];
  if (prefs.dirF !== false) d.push('f');
  if (prefs.dirR) d.push('r');
  return d.length ? d : ['f'];
}

export function compareSource(a: Word, b: Word): number {
  return collator.compare(a.deck || '', b.deck || '') || (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || 0) - (b.createdAt || 0);
}

/**
 * The words in list order. Sorting a course's thousand-plus words is the slow part of building a
 * queue, so the result is kept per words map: the store replaces the map whenever a word changes,
 * while answers only change the cards. Read-only: callers make their own arrays (filter, slice).
 */
const sorted = new WeakMap<Map<string, Word>, readonly Word[]>();
export function sortedWords(words: Map<string, Word>): readonly Word[] {
  let list = sorted.get(words);
  if (!list) sorted.set(words, (list = [...words.values()].filter((w) => w && w.term).sort(compareSource)));
  return list;
}

export function deckCounts(words: Map<string, Word>): [string, number][] {
  const m = new Map<string, number>();
  for (const w of words.values()) m.set(w.deck || '', (m.get(w.deck || '') || 0) + 1);
  return [...m.entries()].sort((a, b) => collator.compare(a[0], b[0]));
}
export const deckNames = (words: Map<string, Word>) => deckCounts(words).map(([d]) => d).filter(Boolean);

/**
 * Where a deck is in the course: "Lektion 10", "Unit 10" or "Lesson 10" → 10, a level A1 → 1,
 * A2 → 2, B1 → 3 … C2 → 6. Null for a deck that is neither (your own words, say).
 */
export function lessonNumber(deck: string | null | undefined): number | null {
  const d = (deck ?? '').trim();
  const lesson = /^(?:lektion|lesson|unit)\s+(\d+)$/i.exec(d);
  if (lesson) return Number(lesson[1]);
  const level = /^([abc])([12])$/i.exec(d);
  return level ? (level[1].toLowerCase().charCodeAt(0) - 97) * 2 + Number(level[2]) : null;
}

/**
 * New words for "All decks" once the teacher has set the class's lesson: that lesson first, then
 * the ones before it, newest first (10, 9, 8 …), so a class on Lektion 10 isn't sent back to
 * Lektion 2 first. Lessons after it wait until the class gets there (pick the deck to study one
 * early). Other decks, like your own words, come after, as before. Without a class lesson, new
 * words come in book order. Within a lesson, the order is kept: recognition before production.
 */
export function orderNewWords<T extends { word: Word }>(fresh: T[], classLesson: string | null | undefined): T[] {
  const current = lessonNumber(classLesson);
  if (current === null) return fresh;
  const rank = (w: Word) => {
    const n = lessonNumber(w.deck);
    return n === null ? current + 1 : n <= current ? current - n : -1; // -1: later lesson, held back
  };
  return fresh
    .map((x, i) => ({ x, i, r: rank(x.word) }))
    .filter((e) => e.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((e) => e.x);
}

export function currentDeck(data: StudyData): string {
  const d = data.prefs.studyDeck || 'all';
  return d === 'all' || deckNames(data.words).includes(d) ? d : 'all';
}

export function nextOrder(words: Map<string, Word>, deck: string): number {
  let max = 0;
  for (const w of words.values()) if ((w.deck || '') === deck) max = Math.max(max, w.order || 0);
  return max + 1;
}

export function latestDeck(words: Map<string, Word>): string {
  let best: Word | null = null;
  for (const w of words.values()) if (!best || (w.createdAt || 0) > (best.createdAt || 0)) best = w;
  return best?.deck || '';
}

export const lapsesOf = (doc: CardDoc | undefined) => Math.max(doc?.f?.lapses || 0, doc?.r?.lapses || 0);

/* ---------- study queue ---------- */

export interface QueueItem {
  word: Word;
  dir: Dir;
  s: CardState | null;
  key: string; // `${wordId}:${dir}`, seeds the interval fuzz
}

export interface Queue {
  learning: QueueItem[];
  review: QueueItem[];
  fresh: QueueItem[];
  newToday: number;
  reviewsToday: number;
  newLeft: number;
  reviewLeft: number;
  counts: { fresh: number; learning: number; review: number };
}

export function buildQueue(data: StudyData, now: number): Queue {
  const today = dayIndex(now);
  const deck = currentDeck(data);
  const words = sortedWords(data.words).filter((w) => deck === 'all' || (w.deck || '') === deck);
  const learning: QueueItem[] = [];
  const review: QueueItem[] = [];
  let fresh: QueueItem[] = [];
  let newToday = 0;
  let reviewsToday = 0;

  // Every recognition card comes before its production sibling.
  for (const dir of enabledDirs(data.prefs)) {
    for (const w of words) {
      const doc = data.cards.get(w.id);
      if (doc?.suspended) continue;
      const s = doc?.[dir] || null;
      if (s?.first && dayIndex(s.first) === today) newToday++;
      if (s?.log) for (const e of s.log) if (e.k === 'review' && dayIndex(e.t) === today) reviewsToday++;
      const item: QueueItem = { word: w, dir, s, key: `${w.id}:${dir}` };
      if (!s || s.type === 'new') fresh.push(item);
      else if (s.type === 'review') {
        if (dayIndex(s.due) <= today) review.push(item);
      } else learning.push(item);
    }
  }
  learning.sort((a, b) => a.s!.due - b.s!.due);
  review.sort((a, b) => a.s!.due - b.s!.due);
  if (deck === 'all') fresh = orderNewWords(fresh, data.classLesson);

  const { prefs } = data;
  const bonus = prefs.bonusNew?.day === today ? prefs.bonusNew.n : 0;
  const newLeft = Math.max(0, (prefs.newPerDay ?? 20) + bonus - newToday);
  const reviewLeft = Math.max(0, (prefs.maxReviews ?? 200) - reviewsToday);
  return {
    learning, review, fresh, newToday, reviewsToday, newLeft, reviewLeft,
    counts: {
      fresh: Math.min(fresh.length, newLeft),
      learning: learning.filter((x) => dayIndex(x.s!.due) <= today).length,
      review: Math.min(review.length, reviewLeft),
    },
  };
}

/** Order: learning cards that are due → reviews → new cards → learning cards due soon. */
/**
 * The der/die/das quiz: on a recognition card for a noun with an article, the article is hidden
 * and the learner picks it first. Returns the right article, or '' when there is no quiz.
 */
export function quizArticle(item: Pick<QueueItem, 'word' | 'dir'> | null, prefs: Pick<Prefs, 'genderQuiz'>, articles = true): Article | '' {
  if (!item || !prefs.genderQuiz || item.dir !== 'f' || !articles) return '';
  return genderOf(item.word.term);
}

export function pickNext(q: Queue, now: number): QueueItem | null {
  const dueLearning = q.learning.find((x) => x.s!.due <= now);
  if (dueLearning) return dueLearning;
  if (q.review.length && q.reviewLeft > 0) return q.review[0];
  if (q.fresh.length && q.newLeft > 0) return q.fresh[0];
  return q.learning.find((x) => x.s!.due <= now + LEARN_AHEAD) || null;
}

/** When does the next card come back? (learning cards later today, or the next review day) */
export function nextDueSummary(data: StudyData, now: number) {
  const today = dayIndex(now);
  const deck = currentDeck(data);
  let soonest: number | null = null;
  let day = Infinity;
  let count = 0;
  for (const w of data.words.values()) {
    if (deck !== 'all' && (w.deck || '') !== deck) continue;
    const doc = data.cards.get(w.id);
    if (doc?.suspended) continue;
    for (const dir of enabledDirs(data.prefs)) {
      const s = doc?.[dir];
      if (!s || s.type === 'new') continue;
      if (s.type !== 'review' && dayIndex(s.due) <= today && s.due > now && (soonest === null || s.due < soonest)) soonest = s.due;
      if (s.type === 'review') {
        const di = dayIndex(s.due);
        if (di > today) {
          if (di < day) {
            day = di;
            count = 1;
          } else if (di === day) count++;
        }
      }
    }
  }
  return { soonest, day: Number.isFinite(day) ? day : null, count };
}

/** Cards due on each of the next `days` study days (overdue and learning cards count as today). */
export function dueForecast(data: StudyData, now: number, days: number, deck = 'all'): number[] {
  const today = dayIndex(now);
  const out = Array<number>(days).fill(0);
  for (const w of data.words.values()) {
    if (deck !== 'all' && (w.deck || '') !== deck) continue;
    const doc = data.cards.get(w.id);
    if (doc?.suspended) continue;
    for (const dir of enabledDirs(data.prefs)) {
      const s = doc?.[dir];
      if (!s || s.type === 'new') continue;
      const k = Math.max(0, dayIndex(s.due) - today);
      if (k < days) out[k]++;
    }
  }
  return out;
}

/* ---------- per-word status (table, gallery, filters) ---------- */

export type Status = 'new' | 'learning' | 'review' | 'suspended';

export interface WordInfo {
  s: CardState | null;
  status: Status;
  relearning: boolean;
  lapses: number;
  leech: boolean;
  dueToday: boolean;
  dueMs: number | null;
  ease: number | null;
  ivl: number | null;
}

export function stateInfo(s: CardState | null | undefined, suspended: boolean, today: number, lapses = s?.lapses || 0): WordInfo {
  const started = !!s && s.type !== 'new';
  return {
    s: s || null,
    status: suspended ? 'suspended' : !started ? 'new' : s!.type === 'review' ? 'review' : 'learning',
    relearning: s?.type === 'relearning',
    lapses,
    leech: lapses >= LEECH_AT,
    dueToday: !suspended && started && dayIndex(s!.due) <= today,
    dueMs: started ? s!.due : null,
    ease: started ? s!.ease : null,
    ivl: s?.type === 'review' ? s.ivl : null,
  };
}

export function wordInfo(data: StudyData, w: Word, today: number): WordInfo {
  const doc = data.cards.get(w.id);
  return stateInfo(doc?.[enabledDirs(data.prefs)[0]], !!doc?.suspended, today, lapsesOf(doc));
}

/* ---------- progress page ---------- */

export function computeStats(data: StudyData, now: number) {
  const today = dayIndex(now);
  const dirs = enabledDirs(data.prefs);
  const fach = [0, 0, 0, 0, 0]; // Leitner-box compartments by interval
  const hist = new Map<number, { ok: number; again: number }>();
  let retOk = 0;
  let retN = 0;
  let todayN = 0;
  const hard: { w: Word; lapses: number; ease: number }[] = [];

  for (const w of data.words.values()) {
    const doc = data.cards.get(w.id);
    let lapses = 0;
    let minEase = Infinity;
    let seen = false;
    for (const d of ['f', 'r'] as const) {
      const s = doc?.[d];
      if (dirs.includes(d) && !doc?.suspended) {
        if (!s || s.type !== 'review') fach[0]++;
        else fach[s.ivl <= 2 ? 1 : s.ivl <= 7 ? 2 : s.ivl <= 20 ? 3 : 4]++;
      }
      if (!s || s.type === 'new') continue;
      seen = true;
      lapses += s.lapses || 0;
      minEase = Math.min(minEase, s.ease);
      for (const e of s.log || []) {
        const di = dayIndex(e.t);
        const h = hist.get(di) || { ok: 0, again: 0 };
        if (e.r === 'again') h.again++;
        else h.ok++;
        hist.set(di, h);
        if (di === today) todayN++;
        if (e.k === 'review' && today - di < 30) {
          retN++;
          if (e.r !== 'again') retOk++;
        }
      }
    }
    if (seen && (lapses > 0 || minEase < SRS_DEFAULTS.startEase)) hard.push({ w, lapses, ease: minEase });
  }
  hard.sort((a, b) => b.lapses - a.lapses || a.ease - b.ease);

  let streak = 0;
  for (let d = hist.has(today) ? today : today - 1; hist.has(d); d--) streak++;

  const days = Array.from({ length: 14 }, (_, k) => {
    const di = today - 13 + k;
    return { di, ...(hist.get(di) || { ok: 0, again: 0 }) };
  });

  return {
    today,
    fach,
    forecast: dueForecast(data, now, 14),
    days,
    streak,
    retention: retN ? retOk / retN : null,
    retN,
    todayN,
    hard: hard.slice(0, 6),
    total: fach.reduce((a, b) => a + b, 0),
  };
}
