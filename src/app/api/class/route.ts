import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { isClassMember } from '@/lib/types';

/** GET /api/class → everyone in the class: streaks, active words, answers. Never their cards. Members only. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  if (!isClassMember(auth.user)) return Response.json({ error: 'Add your class code to see your class.' }, { status: 403 });
  return ok(await repo.classOverview(auth.user.id));
}
