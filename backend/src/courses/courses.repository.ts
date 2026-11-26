import { Injectable } from '@nestjs/common';
import { isTargetLang, type Course, type TargetLang } from '@/lib/courses';
import { type Role } from '@/lib/types';
import { Database, type Row } from '@api/database/database.service';
import { str, num } from '@api/common/db-util';

export const toCourse = (r: Row): Course => ({
  id: str(r.id),
  name: str(r.name),
  targetLang: (isTargetLang(r.target_lang) ? r.target_lang : 'de') as TargetLang,
  note: str(r.note),
  currentLesson: r.current_lesson ? str(r.current_lesson) : null,
  words: num(r.words),
});

export const COURSE_SELECT = `SELECT c.id, c.name, c.target_lang, c.note, c.current_lesson,
  (SELECT count(*)::int FROM words w WHERE w.course_id = c.id AND w.owner_id IS NULL) AS words FROM courses c`;

@Injectable()
export class CoursesRepository {
  constructor(
    private readonly database: Database,
  ) {}

  /** Every course, in the order the picker shows them. */
  async listCourses(): Promise<Course[]> {
    const db = await this.database.get();
    const r = await db.query(`${COURSE_SELECT} ORDER BY c.sort, c.name`);
    return r.rows.map(toCourse);
  }

  async getCourse(id: string): Promise<Course | null> {
    const db = await this.database.get();
    const r = await db.query(`${COURSE_SELECT} WHERE c.id = $1`, [id]);
    return r.rows[0] ? toCourse(r.rows[0]) : null;
  }

  /** The courses someone may run in /admin: every course for admins, else the ones they teach. */
  async taughtCourses(user: { id: string; role: Role }): Promise<Course[]> {
    const all = await this.listCourses();
    if (user.role === 'admin') return all;
    const db = await this.database.get();
    const r = await db.query(`SELECT course_id FROM course_members WHERE user_id = $1 AND role = 'teacher'`, [user.id]);
    const mine = new Set(r.rows.map((row) => str(row.course_id)));
    return all.filter((c) => mine.has(c.id));
  }

  /** Rename a course or change its note ("More words coming soon"). */
  async updateCourse(id: string, patch: { name: string; note: string }): Promise<void> {
    const db = await this.database.get();
    await db.query('UPDATE courses SET name = $2, note = $3 WHERE id = $1', [id, patch.name, patch.note]);
  }

  /** Is this person in the course (and how)? Null: not a member. */
  async membership(courseId: string, userId: string): Promise<{ role: 'student' | 'teacher'; onBoard: boolean } | null> {
    const db = await this.database.get();
    const r = await db.query('SELECT role, on_board FROM course_members WHERE course_id = $1 AND user_id = $2', [courseId, userId]);
    const row = r.rows[0];
    return row ? { role: row.role === 'teacher' ? 'teacher' : 'student', onBoard: row.on_board !== false } : null;
  }

  /** A new course (by an admin). Its id is also its link, /c/<id>. 'taken': that id is in use. */
  async createCourse(
    c: { id: string; name: string; targetLang: TargetLang; note?: string }, now = Date.now(),
  ): Promise<'ok' | 'taken'> {
    const db = await this.database.get();
    const r = await db.query(
      `INSERT INTO courses (id, name, target_lang, note, sort, created_at)
       VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort), 0) + 1 FROM courses), $5)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [c.id, c.name, c.targetLang, c.note ?? '', now],
    );
    return r.rowCount ? 'ok' : 'taken';
  }

  /**
   * Make `courseId` your active course, joining it first if you're new to it (on its leaderboard,
   * as a student). Your progress in other courses stays. False when there is no such course.
   */
  async joinCourse(userId: string, courseId: string, now = Date.now()): Promise<boolean> {
    const db = await this.database.get();
    const r = await db.query(
      `WITH c AS (SELECT id FROM courses WHERE id = $2), m AS (
         INSERT INTO course_members (course_id, user_id, joined_at) SELECT id, $1, $3 FROM c
         ON CONFLICT (course_id, user_id) DO NOTHING
       )
       UPDATE users SET course_id = c.id FROM c WHERE users.id = $1 RETURNING users.id`,
      [userId, courseId, now],
    );
    return r.rowCount > 0;
  }

  /** Teachers take someone off their course's leaderboard or put them back (off it, they keep studying as usual). */
  async setOnBoard(courseId: string, userId: string, onBoard: boolean): Promise<void> {
    const db = await this.database.get();
    await db.query('UPDATE course_members SET on_board = $3 WHERE course_id = $1 AND user_id = $2', [courseId, userId, onBoard]);
  }

  /** A course's teachers edit its shared words, set its lesson and see its dashboard. */
  async setCourseRole(courseId: string, userId: string, role: 'student' | 'teacher'): Promise<void> {
    const db = await this.database.get();
    await db.query('UPDATE course_members SET role = $3 WHERE course_id = $1 AND user_id = $2', [courseId, userId, role]);
  }

  /** The lesson a course's class is on ("Lektion 10"), set by a teacher in /admin. Null: not set (book order). */
  async getClassLesson(courseId: string): Promise<string | null> {
    const db = await this.database.get();
    const r = await db.query('SELECT current_lesson FROM courses WHERE id = $1', [courseId]);
    return r.rows[0]?.current_lesson ? str(r.rows[0].current_lesson) : null;
  }

  /** Set it to one of the course's shared decks, or clear it (null). False when none of its shared words has that deck. */
  async setClassLesson(courseId: string, deck: string | null): Promise<boolean> {
    const db = await this.database.get();
    const r = await db.query(
      `UPDATE courses SET current_lesson = $2::text WHERE id = $1 AND ($2::text IS NULL OR EXISTS (
         SELECT 1 FROM words WHERE owner_id IS NULL AND course_id = $1 AND data->>'deck' = $2::text
       )) RETURNING id`,
      [courseId, deck],
    );
    return r.rowCount > 0;
  }

  /** A course's shared decks with their word counts, for the teacher's lesson picker. */
  async sharedDecks(courseId: string): Promise<{ deck: string; words: number }[]> {
    const db = await this.database.get();
    const r = await db.query(
      `SELECT data->>'deck' AS deck, count(*)::int AS n FROM words
       WHERE course_id = $1 AND owner_id IS NULL AND coalesce(data->>'deck', '') <> '' GROUP BY 1`,
      [courseId],
    );
    const collator = new Intl.Collator('de', { numeric: true });
    return r.rows.map((row) => ({ deck: str(row.deck), words: num(row.n) })).sort((a, b) => collator.compare(a.deck, b.deck));
  }
}
