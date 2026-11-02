import { ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { findTest } from '@/lib/server/tests';
import { publicTest } from '@/lib/tests/score';

/** GET /api/tests/:id → a test of your course to take: the questions, without the answers. */
export async function GET(req: Request, ctx: RouteContext<'/api/tests/[id]'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const test = findTest((await ctx.params).id);
  if (!test || test.course !== auth.user.courseId) return Response.json({ error: 'That test isn’t in your course.' }, { status: 404 });
  return ok({ test: publicTest(test) });
}
