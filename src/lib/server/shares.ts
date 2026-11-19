/**
 * Sharing a result: a public link (/s/<id>) to a snapshot of a mock test score or a streak.
 * Only the person themselves can share, only their own complete attempts, and the snapshot
 * holds only their first name and the numbers.
 */
import { randomBytes } from 'node:crypto';
import { isTargetLang } from '../courses';
import { firstName, isShareId, type ShareCard } from '../share';
import { getDb } from './db';
import * as repo from './repo';
import { findTest } from './tests';

async function save(userId: string, ref: string, card: ShareCard, now: number): Promise<string> {
  const db = await getDb();
  const r = await db.query(
    `INSERT INTO shares (id, user_id, ref, data, created_at) VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (user_id, ref) DO UPDATE SET ref = excluded.ref
     RETURNING id`,
    [randomBytes(12).toString('base64url'), userId, ref, JSON.stringify(card), now],
  );
  return String(r.rows[0].id);
}

/** Share one of your own complete mock test attempts. Null for anyone else's, or one still being scored. */
export async function shareTest(user: repo.UserRow, attemptId: string, now = Date.now()): Promise<string | null> {
  const attempt = await repo.getAttempt(attemptId);
  if (!attempt || attempt.userId !== user.id || !attempt.complete) return null;
  const test = findTest(attempt.testId);
  if (!test) return null;
  const course = await repo.getCourse(attempt.courseId);
  return save(user.id, `test:${attempt.id}`, {
    kind: 'test', name: firstName(user.displayName), course: attempt.courseId, targetLang: course?.targetLang ?? 'de',
    title: test.title, subtitle: test.subtitle, level: test.level, final: test.kind === 'final',
    score: attempt.result.score, max: attempt.result.max, passed: attempt.result.passed,
  }, now);
}

/** Share your streak (in your current course). Null before your first day. */
export async function shareStreak(user: repo.UserRow, now = Date.now()): Promise<string | null> {
  const { days } = await repo.myStreak(user.id, now);
  if (days < 1) return null;
  const course = await repo.getCourse(user.courseId);
  return save(user.id, `streak:${user.courseId}:${days}`, {
    kind: 'streak', name: firstName(user.displayName), course: user.courseId, targetLang: course?.targetLang ?? 'de', streak: days,
  }, now);
}

/** A share for its public page and preview image, or null (unknown id, or the profile was deleted). */
export async function getShare(id: string): Promise<ShareCard | null> {
  if (!isShareId(id)) return null;
  const db = await getDb();
  const r = await db.query('SELECT data FROM shares WHERE id = $1', [id]);
  const raw = r.rows[0]?.data;
  const card = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ShareCard | undefined;
  if (!card || (card.kind !== 'test' && card.kind !== 'streak') || !isTargetLang(card.targetLang)) return null;
  return card;
}
