import { AiError, aiEnabled } from '@/lib/server/ai';
import { gradeOpen } from '@/lib/server/ai-grade';
import { ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { attemptDetail, findTest } from '@/lib/server/tests';
import { HOUR } from '@/lib/time';
import { scoreAttempt } from '@/lib/tests/score';
import { UI_LANGS, type UiLang } from '@/lib/types';

/**
 * POST /api/tests/attempts/:id/feedback { lang } → the attempt with its writing and speaking
 * scored by the AI examiner, feedback in `lang`. Only for your own attempt; 8 an hour.
 * When the AI fails, the reason is kept on the attempt so the result screen can show it.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/tests/attempts/[id]/feedback'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  const attempt = await repo.getAttempt((await ctx.params).id);
  const test = attempt && findTest(attempt.testId);
  if (!attempt || !test || attempt.userId !== user.id) return Response.json({ error: 'That attempt doesn’t exist.' }, { status: 404 });
  if (attempt.result.complete) return ok({ attempt: attemptDetail(attempt, test) });
  if (!aiEnabled()) return Response.json({ error: 'The AI helper isn’t switched on for this app.' }, { status: 503 });
  if (!(await hit(`test-feedback:${user.id}`, 8, HOUR))) {
    return Response.json({ error: 'You’ve asked for a lot of feedback this hour. Try again later.' }, { status: 429 });
  }
  if (!(await repo.claimAttemptGrading(attempt.id))) {
    return Response.json({ error: 'Your writing and speaking are being checked. Open the result again in a moment.' }, { status: 409 });
  }
  const body = (await readJson(req)) as { lang?: unknown } | undefined;
  const lang: UiLang = UI_LANGS.includes(body?.lang as UiLang) ? (body!.lang as UiLang) : 'en';
  try {
    const graded = await gradeOpen(test, attempt.answers, lang);
    const result = scoreAttempt(test, attempt.answers, { ...attempt.result.open, ...graded });
    await repo.updateAttemptResult(attempt.id, result, null);
    return ok({ attempt: attemptDetail({ ...attempt, result, aiError: null }, test) });
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
    await repo.updateAttemptResult(attempt.id, attempt.result, e.message);
    return Response.json({ error: e.message }, { status: e.status });
  }
}
