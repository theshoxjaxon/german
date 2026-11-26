import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Answers, AttemptSummary, TestResult } from '@/lib/tests/types';
import { Database, type Row } from '@api/database/database.service';
import { str, num, parse } from '@api/common/db-util';

export interface AttemptRow {
  id: string;
  userId: string;
  courseId: string;
  testId: string;
  answers: Answers;
  result: TestResult;
  score: number;
  complete: boolean;
  aiError: string | null;
  startedAt: number | null;
  submittedAt: number;
}

export function toAttempt(r: Row): AttemptRow {
  return {
    id: str(r.id),
    userId: str(r.user_id),
    courseId: str(r.course_id),
    testId: str(r.test_id),
    answers: parse<Answers>(r.answers) ?? {},
    result: parse<TestResult>(r.result)!,
    score: num(r.score),
    complete: r.complete === true,
    aiError: r.ai_error == null ? null : str(r.ai_error),
    startedAt: r.started_at == null ? null : num(r.started_at),
    submittedAt: num(r.submitted_at),
  };
}

/** The short form for lists (no answers or item-by-item results). */
export const attemptSummary = (a: Pick<AttemptRow, 'id' | 'testId' | 'result' | 'submittedAt'>): AttemptSummary => ({
  id: a.id,
  testId: a.testId,
  score: a.result.score,
  max: a.result.max,
  complete: a.result.complete,
  passed: a.result.passed,
  sections: a.result.sections,
  submittedAt: a.submittedAt,
});

@Injectable()
export class AttemptsRepository {
  constructor(
    private readonly database: Database,
  ) {}

  /** Save a submitted attempt. Returns its id. */
  async saveAttempt(
    a: { userId: string; courseId: string; testId: string; answers: Answers; result: TestResult; startedAt: number | null },
    now = Date.now(),
  ): Promise<string> {
    const db = await this.database.get();
    const id = `t_${randomBytes(9).toString('base64url')}`;
    await db.query(
      `INSERT INTO test_attempts (id, user_id, course_id, test_id, answers, result, score, complete, started_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)`,
      [id, a.userId, a.courseId, a.testId, JSON.stringify(a.answers), JSON.stringify(a.result), a.result.score, a.result.complete, a.startedAt, now],
    );
    return id;
  }

  async getAttempt(id: string): Promise<AttemptRow | null> {
    const db = await this.database.get();
    const r = await db.query('SELECT * FROM test_attempts WHERE id = $1', [id]);
    return r.rows[0] ? toAttempt(r.rows[0]) : null;
  }

  /** After the AI has scored the writing and speaking (or couldn't: `aiError`). */
  async updateAttemptResult(id: string, result: TestResult, aiError: string | null, now = Date.now()): Promise<void> {
    const db = await this.database.get();
    // graded_at stays empty until the result is complete, so a failed check can be retried at once
    await db.query(
      'UPDATE test_attempts SET result = $2::jsonb, score = $3, complete = $4, ai_error = $5, graded_at = $6 WHERE id = $1',
      [id, JSON.stringify(result), result.score, result.complete, aiError, result.complete ? now : null],
    );
  }

  /**
   * Start the AI check of an attempt, unless one is already running (for up to 2 minutes): two
   * open result screens, or a double tap, then cost one AI request instead of two.
   */
  async claimAttemptGrading(id: string, now = Date.now()): Promise<boolean> {
    const db = await this.database.get();
    const r = await db.query(
      'UPDATE test_attempts SET graded_at = $2 WHERE id = $1 AND NOT complete AND (graded_at IS NULL OR graded_at < $3) RETURNING id',
      [id, now, now - 2 * 60_000],
    );
    return r.rows.length > 0;
  }

  /** Your attempts in a course, newest first. */
  async listAttempts(userId: string, courseId: string): Promise<AttemptSummary[]> {
    const db = await this.database.get();
    const r = await db.query(
      'SELECT id, test_id, result, submitted_at FROM test_attempts WHERE user_id = $1 AND course_id = $2 ORDER BY submitted_at DESC LIMIT 200',
      [userId, courseId],
    );
    return r.rows.map((row) => attemptSummary({ id: str(row.id), testId: str(row.test_id), result: parse<TestResult>(row.result)!, submittedAt: num(row.submitted_at) }));
  }

  /** For /admin/tests: everyone in the course and all their attempts (no email addresses). */
  async courseTestResults(courseId: string): Promise<{
    people: { id: string; displayName: string; avatarUrl: string | null }[];
    attempts: (AttemptSummary & { userId: string })[];
  }> {
    const db = await this.database.get();
    const [people, attempts] = await Promise.all([
      db.query(
        `SELECT u.id, u.display_name, u.avatar_url FROM course_members m JOIN users u ON u.id = m.user_id
         WHERE m.course_id = $1 ORDER BY u.display_name`,
        [courseId],
      ),
      db.query(
        `SELECT a.id, a.user_id, a.test_id, a.result, a.submitted_at FROM test_attempts a
         JOIN course_members m ON m.user_id = a.user_id AND m.course_id = a.course_id
         WHERE a.course_id = $1 ORDER BY a.submitted_at DESC LIMIT 5000`,
        [courseId],
      ),
    ]);
    return {
      people: people.rows.map((r) => ({ id: str(r.id), displayName: str(r.display_name), avatarUrl: r.avatar_url == null ? null : str(r.avatar_url) })),
      attempts: attempts.rows.map((r) => ({
        ...attemptSummary({ id: str(r.id), testId: str(r.test_id), result: parse<TestResult>(r.result)!, submittedAt: num(r.submitted_at) }),
        userId: str(r.user_id),
      })),
    };
  }
}
