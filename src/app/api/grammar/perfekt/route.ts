import { perfektVerbs } from '@/lib/grammar/verbs';
import { applySession, pickSession, progressOf, sanitizeState, MAX_ANSWERS, type Given, type Task } from '@/lib/grammar/session';
import { aiEnabled } from '@/lib/server/ai';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { HOUR } from '@/lib/time';

const TOPIC = 'perfekt';

/**
 * GET /api/grammar/perfekt → the Perfekt verbs, your progress (per rule), the next session's
 * 10 tasks, and whether the AI writing check is on.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const now = Date.now();
  const verbs = perfektVerbs();
  const state = sanitizeState(await repo.getGrammar(auth.user.id, TOPIC));
  return ok({ verbs, progress: progressOf(state, now), tasks: pickSession(verbs, state, now), ai: aiEnabled() });
}

/**
 * POST /api/grammar/perfekt { answers: [{ task, given }] } → a finished session. Every answer is
 * checked again here (what the browser says counts for nothing), then the rule bars and the verb
 * schedules move and the answers count toward today's activity. Returns the new progress, how
 * the session went and the next session's tasks.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { answers?: unknown } | undefined;
  const list = Array.isArray(body?.answers) ? body.answers : null;
  if (!list?.length || list.length > MAX_ANSWERS) return badRequest('No answers to save.');
  const answers = list
    .filter((a): a is { task: Task; given: Given } => !!a && typeof a === 'object' && !!(a as { task?: unknown }).task && typeof (a as { task?: unknown }).task === 'object')
    .map((a) => ({ task: a.task, given: a.given }));
  if (!(await hit(`grammar:${auth.user.id}`, 30, HOUR))) {
    return Response.json({ error: 'That’s a lot of practice for one hour. Take a break and come back later.' }, { status: 429 });
  }
  const now = Date.now();
  const verbs = perfektVerbs();
  const out = applySession(sanitizeState(await repo.getGrammar(auth.user.id, TOPIC)), verbs, answers, now);
  if (!out.answered) return badRequest('No answers to save.');
  await repo.saveGrammar(auth.user.id, TOPIC, out.state, out.answered, now);
  const { answered, right, before, after, missed } = out;
  return ok({ progress: progressOf(out.state, now), outcome: { answered, right, before, after, missed }, tasks: pickSession(verbs, out.state, now) });
}
