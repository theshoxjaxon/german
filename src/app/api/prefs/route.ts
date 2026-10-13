import { ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/** PUT /api/prefs saves your study settings. Unknown or invalid fields keep their current value. */
export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  return ok(await repo.putPrefs(auth.user.id, await readJson(req)));
}
