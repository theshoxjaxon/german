import { Injectable } from '@nestjs/common';
import { Answers } from '@/lib/tests/types';
import { cardFlags, diffActivity, isRecalled, masteredAt, shiftDay, streakFrom } from '@/lib/stats';
import { DEFAULT_PREFS, type CardDoc, type Prefs } from '@/lib/types';
import { sanitizeCard, sanitizePrefs } from '@api/common/validate';
import { Database } from '@api/database/database.service';
import { str, num, parse, FOREIGN_KEY_VIOLATION, todayKey } from '@api/common/db-util';



@Injectable()
export class CardsRepository {
  constructor(
    private readonly database: Database,
  ) {}

  /** Your progress on a course's words. */
  async listCards(userId: string, courseId: string): Promise<Record<string, CardDoc>> {
    const db = await this.database.get();
    const r = await db.query(
      'SELECT c.word_id, c.data FROM cards c JOIN words w ON w.id = c.word_id WHERE c.user_id = $1 AND w.course_id = $2',
      [userId, courseId],
    );
    const out: Record<string, CardDoc> = {};
    for (const row of r.rows) {
      const c = sanitizeCard(parse(row.data));
      if (c) out[str(row.word_id)] = c;
    }
    return out;
  }

  /**
   * Save (or with null, reset) one word's progress and count the new answers toward today's
   * activity. Two round trips: read the previous state, then write the card and the day's
   * activity in one statement.
   */
  async putCard(userId: string, wordId: string, doc: CardDoc | null, now = Date.now()): Promise<'ok' | 'no-word'> {
    const db = await this.database.get();
    if (!doc) {
      await db.query('DELETE FROM cards WHERE user_id = $1 AND word_id = $2', [userId, wordId]);
      return 'ok';
    }
    const read = await db.query(
      `SELECT EXISTS (SELECT 1 FROM words WHERE id = $2 AND (owner_id IS NULL OR owner_id = $1)) AS visible,
              (SELECT data FROM cards WHERE user_id = $1 AND word_id = $2) AS prev`,
      [userId, wordId],
    );
    if (!read.rows[0]?.visible) return 'no-word';
    const prev = sanitizeCard(parse(read.rows[0].prev));
    const flags = cardFlags(doc);
    const { answers, newCards, reviews, recalled } = diffActivity(prev, doc);
    // Kept once set (COALESCE): a word stays mastered in the history even if it is forgotten later.
    const mastered = masteredAt(doc) ?? (flags.mature ? now : null);
    try {
      await db.query(
        `WITH card AS (
           INSERT INTO cards (user_id, word_id, data, started, mature, mastered_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5, $10::bigint, $6)
           ON CONFLICT (user_id, word_id) DO UPDATE SET data = excluded.data, started = excluded.started,
             mature = excluded.mature, mastered_at = COALESCE(cards.mastered_at, excluded.mastered_at), updated_at = excluded.updated_at
         )
         INSERT INTO activity (user_id, day, answers, new_cards, reviews, recalled) SELECT $1, $7, $8, $9, $11, $12 WHERE $8::int > 0 OR $9::int > 0
         ON CONFLICT (user_id, day) DO UPDATE SET answers = activity.answers + excluded.answers,
           new_cards = activity.new_cards + excluded.new_cards, reviews = activity.reviews + excluded.reviews,
           recalled = activity.recalled + excluded.recalled`,
        [userId, wordId, JSON.stringify(doc), flags.started, flags.mature, now, todayKey(now), answers, newCards, mastered, reviews, recalled],
      );
    } catch (e) {
      if ((e as { code?: string }).code === FOREIGN_KEY_VIOLATION) return 'no-word'; // deleted a moment ago
      throw e;
    }
    return 'ok';
  }

  /** Reset your progress in one course. Other courses keep theirs. */
  async deleteAllCards(userId: string, courseId: string): Promise<void> {
    const db = await this.database.get();
    await db.query('DELETE FROM cards c USING words w WHERE w.id = c.word_id AND c.user_id = $1 AND w.course_id = $2', [userId, courseId]);
  }

  /**
   * Add the progress someone made as a guest, before they had a profile. Never overwrites:
   * words already studied in the profile keep that progress, and so do saved settings.
   * Answers given today count toward today's activity. Returns how many words were added.
   * One statement, so the cards, the activity and the settings are saved together or not at all.
   */
  async importCards(userId: string, cards: Record<string, CardDoc>, prefs?: unknown, now = Date.now()): Promise<number> {
    const today = todayKey(now);
    const isToday = (t: number) => t > 0 && t <= now && todayKey(t) === today;
    const rows = Object.entries(cards).map(([wordId, doc]) => {
      let answers = 0;
      let newCards = 0;
      let reviews = 0;
      let recalled = 0;
      for (const s of [doc.f, doc.r]) {
        if (!s) continue;
        const todays = s.log.filter((e) => isToday(e.t));
        answers += todays.length;
        for (const e of todays) {
          if (e.k !== 'review') continue;
          reviews++;
          if (isRecalled(e)) recalled++;
        }
        if (s.type !== 'new' && isToday(s.first)) newCards++;
      }
      const flags = cardFlags(doc);
      const mastered = masteredAt(doc) ?? (flags.mature ? now : null);
      return { word_id: wordId, data: doc, ...flags, mastered_at: mastered, answers, new_cards: newCards, reviews, recalled };
    });
    if (!rows.length && prefs === undefined) return 0;
    const db = await this.database.get();
    const r = await db.query(
      `WITH x AS (
         SELECT * FROM jsonb_to_recordset($2::jsonb)
           AS x(word_id text, data jsonb, started int, mature int, mastered_at bigint, answers int, new_cards int, reviews int, recalled int)
       ), added AS (
         INSERT INTO cards (user_id, word_id, data, started, mature, mastered_at, updated_at)
         SELECT $1, x.word_id, x.data, x.started, x.mature, x.mastered_at, $3
         FROM x JOIN words w ON w.id = x.word_id AND (w.owner_id IS NULL OR w.owner_id = $1)
         ON CONFLICT (user_id, word_id) DO NOTHING
         RETURNING word_id
       ), counted AS (
         INSERT INTO activity (user_id, day, answers, new_cards, reviews, recalled)
         SELECT $1, $4, LEAST(sum(x.answers), 1000), LEAST(sum(x.new_cards), 400), LEAST(sum(x.reviews), 1000), LEAST(sum(x.recalled), 1000)
         FROM x JOIN added ON added.word_id = x.word_id
         HAVING sum(x.answers) > 0 OR sum(x.new_cards) > 0
         ON CONFLICT (user_id, day) DO UPDATE SET answers = activity.answers + excluded.answers,
           new_cards = activity.new_cards + excluded.new_cards, reviews = activity.reviews + excluded.reviews,
           recalled = activity.recalled + excluded.recalled
       ), saved_prefs AS (
         INSERT INTO prefs (user_id, data) SELECT $1, $5::jsonb WHERE $5::jsonb IS NOT NULL
         ON CONFLICT (user_id) DO NOTHING
       )
       SELECT count(*)::int AS added FROM added`,
      [userId, JSON.stringify(rows), now, today, prefs === undefined ? null : JSON.stringify(sanitizePrefs(prefs, DEFAULT_PREFS))],
    );
    return num(r.rows[0]?.added);
  }

  async getPrefs(userId: string): Promise<Prefs> {
    const db = await this.database.get();
    const r = await db.query('SELECT data FROM prefs WHERE user_id = $1', [userId]);
    return sanitizePrefs(r.rows[0] ? parse(r.rows[0].data) : null, DEFAULT_PREFS);
  }

  async putPrefs(userId: string, patch: unknown): Promise<Prefs> {
    const prefs = sanitizePrefs(patch, await this.getPrefs(userId));
    const db = await this.database.get();
    await db.query(
      'INSERT INTO prefs (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data',
      [userId, JSON.stringify(prefs)],
    );
    return prefs;
  }

  /** Your streak: days in a row with an answer (up to yesterday if you haven't studied yet today). */
  async myStreak(userId: string, now = Date.now()): Promise<{ days: number; studiedToday: boolean }> {
    const db = await this.database.get();
    const today = todayKey(now);
    const r = await db.query('SELECT day FROM activity WHERE user_id = $1 AND answers > 0 AND day >= $2', [userId, shiftDay(today, -400)]);
    const days = new Set(r.rows.map((row) => str(row.day)));
    return { days: streakFrom(days, today), studiedToday: days.has(today) };
  }
}
