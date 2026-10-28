import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/** GET /api/class → the leaderboard: streaks, active words, answers. Never anyone's cards or email address. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  return ok(await repo.classOverview(auth.user.id));
}
