import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { type Cheer, type CheerKind } from '@/lib/types';
import { Database } from '@api/database/database.service';
import { str, num, todayKey } from '@api/common/db-util';

/** Someone on a course's leaderboard (or one of its teachers): the people you can cheer there. */
export const ON_COURSE_BOARD = `SELECT 1 FROM course_members m JOIN users u ON u.id = m.user_id
  WHERE m.course_id = $7 AND m.user_id = $3 AND (m.on_board OR m.role = 'teacher' OR u.role = 'admin')`;

@Injectable()
export class CheersRepository {
  constructor(
    private readonly database: Database,
  ) {}

  /** Cheer a classmate in `courseId` (your active course). One per classmate per day. */
  async sendCheer(
    fromId: string, toId: string, kind: CheerKind, courseId: string, now = Date.now(),
  ): Promise<'ok' | 'already' | 'no-user' | 'self'> {
    if (fromId === toId) return 'self';
    const db = await this.database.get();
    const r = await db.query(
      `WITH sent AS (
         INSERT INTO cheers (id, from_user, to_user, kind, day, created_at)
         SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (${ON_COURSE_BOARD})
         ON CONFLICT (from_user, to_user, day) DO NOTHING RETURNING id
       )
       SELECT (SELECT count(*)::int FROM sent) AS sent, EXISTS (${ON_COURSE_BOARD}) AS listed`,
      [`c_${randomBytes(9).toString('base64url')}`, fromId, toId, kind, todayKey(now), now, courseId],
    );
    const row = r.rows[0];
    if (num(row?.sent)) return 'ok';
    return row?.listed ? 'already' : 'no-user';
  }

  async unseenCheers(userId: string): Promise<Cheer[]> {
    const db = await this.database.get();
    const r = await db.query(
      `SELECT c.id, c.kind, c.created_at, u.id AS from_id, u.display_name
       FROM cheers c JOIN users u ON u.id = c.from_user
       WHERE c.to_user = $1 AND c.seen_at IS NULL ORDER BY c.created_at DESC LIMIT 20`,
      [userId],
    );
    return r.rows.map((row) => ({
      id: str(row.id),
      kind: str(row.kind) as CheerKind,
      createdAt: num(row.created_at),
      from: { id: str(row.from_id), displayName: str(row.display_name) },
    }));
  }

  async markCheersSeen(userId: string, now = Date.now()): Promise<void> {
    const db = await this.database.get();
    await db.query('UPDATE cheers SET seen_at = $2 WHERE to_user = $1 AND seen_at IS NULL', [userId, now]);
  }
}
