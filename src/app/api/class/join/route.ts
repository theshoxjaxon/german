import { normalizeJoinCode } from '@/lib/account-rules';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { HOUR } from '@/lib/time';

/** POST /api/class/join { code } → a self-learner joins the class with its code. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { code?: unknown } | undefined;
  const code = normalizeJoinCode(body?.code);
  if (!code) return badRequest('Send { code }.');
  // A few tries an hour: plenty for typos, far too few to guess a 6-character code.
  if (!hit(`join:${auth.user.id}`, 10, HOUR)) return Response.json({ error: 'Too many tries. Wait an hour, or ask your teacher.' }, { status: 429 });
  if ((await repo.joinClass(auth.user.id, code)) === 'wrong-code') {
    return Response.json({ error: 'This class code doesn’t match. Check it with your teacher.' }, { status: 400 });
  }
  return ok({ ok: true });
}
