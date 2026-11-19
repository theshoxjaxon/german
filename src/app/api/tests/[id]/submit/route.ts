import { aiEnabled } from '@/lib/server/ai';
import { ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { attemptDetail, findTest } from '@/lib/server/tests';
import { HOUR } from '@/lib/time';
import { cleanAnswers, emptyOpen, scoreAttempt } from '@/lib/tests/score';

/**
 * POST /api/tests/:id/submit { answers, startedAt } → the attempt, scored: everything but the
 * writing and speaking right away (those come from POST /api/tests/attempts/:id/feedback;
 * left empty, they score 0 here).
 * The answer key is only ever used here, on the server.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/tests/[id]/submit'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  const test = findTest((await ctx.params).id);
  if (!test || test.course !== user.courseId) return Response.json({ error: 'That test isn’t in your course.' }, { status: 404 });
  if (!(await hit(`test-submit:${user.id}`, 30, HOUR))) {
    return Response.json({ error: 'You’ve handed in a lot of tests this hour. Try again later.' }, { status: 429 });
  }
  const body = (await readJson(req)) as { answers?: unknown; startedAt?: unknown } | undefined;
  const answers = cleanAnswers(test, body?.answers);
  const now = Date.now();
  const startedAt = typeof body?.startedAt === 'number' && body.startedAt > now - 6 * HOUR && body.startedAt <= now ? body.startedAt : null;
  const result = scoreAttempt(test, answers, emptyOpen(test, answers));
  const id = await repo.saveAttempt({ userId: user.id, courseId: user.courseId, testId: test.id, answers, result, startedAt }, now);
  const attempt = (await repo.getAttempt(id))!;
  return ok({ attempt: attemptDetail(attempt, test), ai: aiEnabled() });
}
