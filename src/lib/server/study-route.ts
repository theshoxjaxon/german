/**
 * Shared by the study routes: the lazy Sunday matching (when the cron job hasn't run yet) and the
 * answer for a group you're not in, which is always the same 404, so nobody can tell whether a
 * group exists.
 */
import { dueWeek } from '../study/week';
import * as repo from './repo';
import { matchDue, purgeStudy } from './study';

const done = new Set<string>(); // course and week matched, as seen by this server process

/** Make the groups now due for the course, if nobody has yet. Cheap after the first time. */
export async function ensureMatched(courseId: string, now = Date.now()): Promise<void> {
  const key = `${courseId} ${dueWeek(now, repo.TIMEZONE)}`;
  if (done.has(key)) return;
  const course = await repo.getCourse(courseId);
  if (!course) return;
  await matchDue([course], now);
  done.add(key);
  if (Math.random() < 0.05) await purgeStudy(now); // the cron job does this too
}

export const noGroup = () => Response.json({ error: 'That group doesn’t exist.' }, { status: 404 });
