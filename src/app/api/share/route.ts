import { badRequest, ok, readJson } from '@/lib/server/http';
import { appUrl } from '@/lib/server/mail';
import { hit } from '@/lib/server/rate-limit';
import { requireUser } from '@/lib/server/session';
import { shareStreak, shareTest } from '@/lib/server/shares';

const DAY = 86_400_000;

/**
 * POST /api/share → { url }: a public link to a snapshot of your result (first name and score).
 *   { kind: 'test', attemptId }  one of your own complete mock test attempts
 *   { kind: 'streak' }           your streak
 * Sharing the same thing again returns the same link.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { kind?: unknown; attemptId?: unknown } | null;
  if (!(await hit(`share:${auth.user.id}`, 30, DAY))) return Response.json({ error: 'Too many shares today. Try again tomorrow.' }, { status: 429 });
  let id: string | null;
  if (body?.kind === 'test' && typeof body.attemptId === 'string') {
    id = await shareTest(auth.user, body.attemptId);
    if (!id) return Response.json({ error: 'That attempt doesn’t exist.' }, { status: 404 });
  } else if (body?.kind === 'streak') {
    id = await shareStreak(auth.user);
    if (!id) return badRequest('Study for a day first, then share your streak.');
  } else {
    return badRequest('Unknown request.');
  }
  return ok({ url: `${await appUrl()}/s/${id}` });
}
