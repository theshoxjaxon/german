/**
 * The daily der/die/das quiz in a public Telegram channel: one German noun a day as a Telegram
 * quiz poll, with a button into the app. It reaches German learners outside the class.
 *
 * Setting: TELEGRAM_CHANNEL, the channel's @name (or its numeric -100… id). The bot must be an
 * admin of the channel that may post. It runs from the evening job (/api/cron/daily) and from
 * "Post today's quiz now" in /admin; either way at most once a day (the day is claimed first).
 */
import { DEFAULT_COURSE } from '../courses';
import { shiftDay } from '../stats';
import { splitTerm } from '../text';
import type { WordData } from '../types';
import { getDb } from './db';
import * as repo from './repo';
import { botConfig, call } from './telegram';

/** How long before a word may come back. */
export const NO_REPEAT_DAYS = 120;
const ARTICLES = ['der', 'die', 'das'] as const;

/** The channel to post in, or null while TELEGRAM_CHANNEL is missing or malformed. */
export function channelId(): string | null {
  const v = process.env.TELEGRAM_CHANNEL?.trim() ?? '';
  return /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v) || /^-100\d{5,15}$/.test(v) ? v : null;
}

const cut = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

/** A small stable hash, so the same day always picks the same word (a retry posts the same quiz). */
function dayHash(day: string): number {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export interface QuizWord {
  id: string;
  term: string; // "der Hund"
  art: (typeof ARTICLES)[number];
  rest: string; // "Hund"
  meaning: string;
  example: string;
}

/**
 * Today's word: a shared noun of the German course with der, die or das, not posted in the last
 * NO_REPEAT_DAYS, from the lesson the class is on when it has one left. Null when there are no nouns.
 */
export async function pickWord(day: string): Promise<QuizWord | null> {
  const db = await getDb();
  const [r, course] = await Promise.all([
    db.query(
      `SELECT w.id, w.data FROM words w
       WHERE w.owner_id IS NULL AND w.course_id = $1 AND w.data->>'pos' = 'noun'
       ORDER BY w.id`,
      [DEFAULT_COURSE],
    ),
    repo.getCourse(DEFAULT_COURSE),
  ]);
  const recent = new Set(
    (await db.query('SELECT word_id FROM channel_posts WHERE day >= $1 AND day < $2', [shiftDay(day, -NO_REPEAT_DAYS), day])).rows.map((x) => String(x.word_id)),
  );
  const nouns: (QuizWord & { deck: string })[] = [];
  for (const row of r.rows) {
    const data = (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) as WordData;
    const { art, rest } = splitTerm(data.term);
    if (!art || !rest || !data.meaning) continue;
    nouns.push({ id: String(row.id), term: `${art} ${rest}`, art, rest, meaning: data.meaning, example: data.example ?? '', deck: data.deck ?? '' });
  }
  const fresh = nouns.filter((n) => !recent.has(n.id));
  const lesson = course?.currentLesson ? fresh.filter((n) => n.deck === course.currentLesson) : [];
  const pool = lesson.length ? lesson : fresh.length ? fresh : nouns; // every noun posted lately: start over
  if (!pool.length) return null;
  const p = pool[dayHash(day) % pool.length];
  return { id: p.id, term: p.term, art: p.art, rest: p.rest, meaning: p.meaning, example: p.example };
}

/** The poll Telegram gets: a quiz with der / die / das and the right one marked. */
export function quizPoll(chatId: string, w: QuizWord, appUrl: string) {
  return {
    chat_id: chatId,
    question: cut(`Qaysi artikl? ___ ${w.rest} (${cut(w.meaning, 80)})`, 300),
    options: ARTICLES.map((text) => ({ text })),
    type: 'quiz',
    correct_option_id: ARTICLES.indexOf(w.art),
    is_anonymous: true, // polls in channels always are
    explanation: cut(w.example ? `${w.term}: ${w.meaning}\n${w.example}` : `${w.term}: ${w.meaning}`, 200),
    reply_markup: { inline_keyboard: [[{ text: 'Har kuni 5 daqiqa mashq →', url: `${appUrl}/${DEFAULT_COURSE}` }]] },
  };
}

export type QuizResult =
  | { posted: true; term: string }
  | { posted: false; reason: 'not-set' | 'already' | 'no-words' | 'failed'; term?: string; error?: string };

/** Post today's quiz, once a day. If Telegram refuses, the day is released so a retry can post. */
export async function postDailyQuiz(appUrl: string, now = Date.now()): Promise<QuizResult> {
  const chat = channelId();
  if (!chat || !botConfig()) return { posted: false, reason: 'not-set' };
  const day = repo.todayKey(now);
  const db = await getDb();
  const done = await db.query('SELECT term FROM channel_posts WHERE day = $1', [day]);
  if (done.rows[0]) return { posted: false, reason: 'already', term: String(done.rows[0].term) };
  const word = await pickWord(day);
  if (!word) return { posted: false, reason: 'no-words' };
  const claim = await db.query(
    'INSERT INTO channel_posts (day, word_id, term, posted_at) VALUES ($1, $2, $3, $4) ON CONFLICT (day) DO NOTHING RETURNING day',
    [day, word.id, word.term, now],
  );
  if (!claim.rows[0]) return { posted: false, reason: 'already', term: word.term }; // another run got there first
  const res = await call('sendPoll', quizPoll(chat, word, appUrl));
  if (res.ok) return { posted: true, term: word.term };
  await db.query('DELETE FROM channel_posts WHERE day = $1 AND posted_at = $2', [day, now]);
  return { posted: false, reason: 'failed', error: res.description };
}

/** For the admin page: which channel, and today's word if it went out. */
export async function channelStatus(now = Date.now()): Promise<{ channel: string | null; today: string | null }> {
  const channel = channelId();
  if (!channel) return { channel: null, today: null };
  const db = await getDb();
  const r = await db.query('SELECT term FROM channel_posts WHERE day = $1', [repo.todayKey(now)]);
  return { channel, today: r.rows[0] ? String(r.rows[0].term) : null };
}
