import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { attemptDetail, findTest } from '@/lib/server/tests';

/**
 * GET /api/tests/attempts/:id → one attempt to review: answers, result, the test with its key.
 * Your own attempts; teachers also see their course's.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/tests/attempts/[id]'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  const attempt = await repo.getAttempt((await ctx.params).id);
  const test = attempt && findTest(attempt.testId);
  const mayRead = !!attempt && (attempt.userId === user.id || user.role === 'admin' || (await repo.membership(attempt.courseId, user.id))?.role === 'teacher');
  if (!attempt || !test || !mayRead) return Response.json({ error: 'That attempt doesn’t exist.' }, { status: 404 });
  return ok({ attempt: attemptDetail(attempt, test) });
}
