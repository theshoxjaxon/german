import { isCourseId } from '@/lib/courses';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { chooseCourse } from '@/lib/server/course';
import * as repo from '@/lib/server/repo';
import { requireUser, sameOrigin } from '@/lib/server/session';

/**
 * POST /api/course { id } switches the course you're studying. Signed in: you join it (if you
 * haven't yet) and it becomes your active course; your progress in other courses stays.
 * Guests: this browser remembers it. Then reload /api/state.
 */
export async function POST(req: Request) {
  const body = (await readJson(req)) as { id?: unknown } | undefined;
  const id = body?.id;
  if (!isCourseId(id)) return badRequest('Send { id }.');
  const auth = await requireUser(req);
  if (auth.response && auth.response.status !== 401) return auth.response;
  if (!(await repo.getCourse(id))) return Response.json({ error: 'That course no longer exists.' }, { status: 404 });
  if (auth.user) await repo.joinCourse(auth.user.id, id);
  else if (sameOrigin(req)) await chooseCourse(id);
  else return Response.json({ error: 'Cross-site request blocked.' }, { status: 403 });
  return ok();
}
