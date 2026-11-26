/**
 * Sharing a result: a public link (/s/<id>) to a snapshot of a mock test score or a streak.
 * Only the person themselves can share, only their own complete attempts, and the snapshot
 * holds only their first name and the numbers.
 */
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { isTargetLang } from '@/lib/courses';
import { firstName, isShareId, type ShareCard } from '@/lib/share';
import { findTest } from '@api/tests/catalog';
import { Database } from '@api/database/database.service';
import type { UserRow } from '@api/users/users.repository';
import { AttemptsRepository } from '@api/tests/attempts.repository';
import { CardsRepository } from '@api/cards/cards.repository';
import { CoursesRepository } from '@api/courses/courses.repository';



@Injectable()
export class SharesService {
  constructor(
    private readonly database: Database,
    private readonly attempts: AttemptsRepository,
    private readonly cardsRepo: CardsRepository,
    private readonly coursesRepo: CoursesRepository,
  ) {}

  async save(userId: string, ref: string, card: ShareCard, now: number): Promise<string> {
    const db = await this.database.get();
    const r = await db.query(
      `INSERT INTO shares (id, user_id, ref, data, created_at) VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (user_id, ref) DO UPDATE SET ref = excluded.ref
       RETURNING id`,
      [randomBytes(12).toString('base64url'), userId, ref, JSON.stringify(card), now],
    );
    return String(r.rows[0].id);
  }

  /** Share one of your own complete mock test attempts. Null for anyone else's, or one still being scored. */
  async shareTest(user: UserRow, attemptId: string, now = Date.now()): Promise<string | null> {
    const attempt = await this.attempts.getAttempt(attemptId);
    if (!attempt || attempt.userId !== user.id || !attempt.complete) return null;
    const test = findTest(attempt.testId);
    if (!test) return null;
    const course = await this.coursesRepo.getCourse(attempt.courseId);
    return this.save(user.id, `test:${attempt.id}`, {
      kind: 'test', name: firstName(user.displayName), course: attempt.courseId, targetLang: course?.targetLang ?? 'de',
      title: test.title, subtitle: test.subtitle, level: test.level, final: test.kind === 'final',
      score: attempt.result.score, max: attempt.result.max, passed: attempt.result.passed,
    }, now);
  }

  /** Share your streak (in your current course). Null before your first day. */
  async shareStreak(user: UserRow, now = Date.now()): Promise<string | null> {
    const { days } = await this.cardsRepo.myStreak(user.id, now);
    if (days < 1) return null;
    const course = await this.coursesRepo.getCourse(user.courseId);
    return this.save(user.id, `streak:${user.courseId}:${days}`, {
      kind: 'streak', name: firstName(user.displayName), course: user.courseId, targetLang: course?.targetLang ?? 'de', streak: days,
    }, now);
  }

  /** A share for its public page and preview image, or null (unknown id, or the profile was deleted). */
  async getShare(id: string): Promise<ShareCard | null> {
    if (!isShareId(id)) return null;
    const db = await this.database.get();
    const r = await db.query('SELECT data FROM shares WHERE id = $1', [id]);
    const raw = r.rows[0]?.data;
    const card = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ShareCard | undefined;
    if (!card || (card.kind !== 'test' && card.kind !== 'streak') || !isTargetLang(card.targetLang)) return null;
    return card;
  }
}
