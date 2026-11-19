import { ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { studyState } from '@/lib/server/study';
import { ensureMatched } from '@/lib/server/study-route';

/**
 * GET /api/study → your study-together page: the week you can sign up for and your free hours,
 * your groups (members by name only), the speaking clubs, and whether the last week found you no
 * group. Makes the week's groups first if Sunday 18:00 has passed and nobody has yet.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  await ensureMatched(auth.user.courseId);
  return ok(await studyState(auth.user));
}
