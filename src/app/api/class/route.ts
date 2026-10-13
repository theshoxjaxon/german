import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/** GET /api/class → everyone in the learning center: streaks, active words, answers. Never their cards. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  return ok(await repo.classOverview(auth.user.id));
}
