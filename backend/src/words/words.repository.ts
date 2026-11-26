import { Injectable } from '@nestjs/common';
import { MAX_OWN_WORDS, type Word, type WordData } from '@/lib/types';
import { sanitizeWord } from '@api/common/validate';
import { Database } from '@api/database/database.service';
import { str, num, parse } from '@api/common/db-util';

/** Which words a write goes to: shared (null) for the course's teachers, their own for everyone else. */
export const ownerFor = (user: { id: string; teacher: boolean }): string | null => (user.teacher ? null : user.id);

@Injectable()
export class WordsRepository {
  constructor(
    private readonly database: Database,
  ) {}

  /**
   * A course's shared words are the same for everyone in it, and they are most of what the app
   * loads (hundreds of KB). Read them once per instance and share the result: a crowd opening the app
   * costs one database read per course per TTL, not one per person. A write on this instance clears
   * the cache at once; another instance shows the change within the TTL. Concurrent callers share one load.
   * ponytail: per instance and time-based; use a version counter in the database if edits must show instantly everywhere.
   */
  private readonly shared = new Map<string, { at: number; words: Promise<Record<string, Word>> }>();
  private readonly SHARED_TTL = process.env.SHARED_WORDS_TTL_MS?.trim() ? Number(process.env.SHARED_WORDS_TTL_MS) || 0 : 30_000; // blank = default

  private sharedWords(courseId: string): Promise<Record<string, Word>> {
    const hit = this.shared.get(courseId);
    if (hit && Date.now() - hit.at < this.SHARED_TTL) return hit.words;
    const words = this.readWords(null, courseId);
    this.shared.set(courseId, { at: Date.now(), words });
    words.catch(() => this.shared.delete(courseId)); // don't keep a failure
    return words;
  }

  private async readWords(userId: string | null, courseId: string): Promise<Record<string, Word>> {
    const db = await this.database.get();
    const r = await db.query(
      userId === null
        ? 'SELECT id, owner_id, data FROM words WHERE course_id = $1 AND owner_id IS NULL'
        : 'SELECT id, owner_id, data FROM words WHERE course_id = $1 AND owner_id = $2',
      userId === null ? [courseId] : [courseId, userId],
    );
    const out: Record<string, Word> = {};
    for (const row of r.rows) {
      const w = sanitizeWord(parse(row.data));
      if (!w) continue;
      const id = str(row.id);
      out[id] = row.owner_id ? { ...w, id, personal: true } : { ...w, id };
    }
    return out;
  }

  /** A course's shared words plus your own words in it (guests: shared only). */
  async listWords(userId: string | null, courseId: string): Promise<Record<string, Word>> {
    const [shared, own] = await Promise.all([this.sharedWords(courseId), userId ? this.readWords(userId, courseId) : {}]);
    return { ...shared, ...own };
  }

  /**
   * Create or update one word in a course. 'forbidden': the id belongs to a word you may not change
   * (someone else's, a shared one for a student, or one in another course). 'limit': too many own words.
   */
  async saveWord(
    owner: string | null, courseId: string, id: string, data: WordData, now = Date.now(),
  ): Promise<'ok' | 'forbidden' | 'limit'> {
    const db = await this.database.get();
    const r = await db.query(
      `INSERT INTO words (id, owner_id, course_id, data, updated_at)
       SELECT $1, $2, $6, $3::jsonb, $4
       WHERE $2::text IS NULL OR EXISTS (SELECT 1 FROM words WHERE id = $1) OR (SELECT count(*) FROM words WHERE owner_id = $2) < $5
       ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
         WHERE words.owner_id IS NOT DISTINCT FROM excluded.owner_id AND words.course_id = excluded.course_id
       RETURNING id`,
      [id, owner, JSON.stringify(data), now, MAX_OWN_WORDS, courseId],
    );
    this.shared.clear();
    if (r.rowCount) return 'ok';
    const exists = await db.query('SELECT 1 FROM words WHERE id = $1', [id]);
    return exists.rowCount ? 'forbidden' : 'limit';
  }

  /** Add many words to a course at once (Import). Ids that belong to someone else are skipped. Returns how many were saved. */
  async putWords(
    owner: string | null, courseId: string, words: { id: string; data: WordData }[], now = Date.now(),
  ): Promise<number> {
    if (!words.length) return 0;
    const db = await this.database.get();
    const r = await db.query(
      `INSERT INTO words (id, owner_id, course_id, data, updated_at)
       SELECT x.id, $2, $4, x.data, $3 FROM jsonb_to_recordset($1::jsonb) AS x(id text, data jsonb)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
         WHERE words.owner_id IS NOT DISTINCT FROM excluded.owner_id AND words.course_id = excluded.course_id`,
      [JSON.stringify(words), owner, now, courseId],
    );
    this.shared.clear();
    return r.rowCount;
  }

  /** Your own words in all courses (the MAX_OWN_WORDS limit is per person). */
  async countOwnWords(userId: string): Promise<number> {
    const db = await this.database.get();
    const r = await db.query('SELECT count(*)::int AS n FROM words WHERE owner_id = $1', [userId]);
    return num(r.rows[0]?.n);
  }

  /** Delete a word you may change. Everyone's progress on it goes too (ON DELETE CASCADE). */
  async deleteWord(owner: string | null, courseId: string, id: string): Promise<'ok' | 'forbidden'> {
    const db = await this.database.get();
    const r = await db.query(
      'DELETE FROM words WHERE id = $1 AND owner_id IS NOT DISTINCT FROM $2 AND course_id = $3 RETURNING id',
      [id, owner, courseId],
    );
    this.shared.clear();
    if (r.rowCount) return 'ok';
    const exists = await db.query('SELECT 1 FROM words WHERE id = $1', [id]);
    return exists.rowCount ? 'forbidden' : 'ok'; // already gone is fine
  }
}
