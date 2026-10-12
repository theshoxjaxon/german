import { mutate } from '@/lib/server/db';
import { ok, readJson } from '@/lib/server/http';
import { sanitizePrefs } from '@/lib/server/validate';

/** PUT /api/prefs saves study settings. Unknown or invalid fields keep their current value. */
export async function PUT(req: Request) {
  const body = await readJson(req);
  const prefs = await mutate((data) => (data.prefs = sanitizePrefs(body, data.prefs)));
  return ok(prefs);
}
