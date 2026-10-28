import { badRequest, ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { CHEERS, isClassMember, type CheerKind } from '@/lib/types';

/** POST /api/cheers { to, kind } sends a classmate encouragement. One per classmate per day. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  // Someone a teacher took off the leaderboard can't send cheers either
  if (!isClassMember(auth.user)) return Response.json({ error: 'Cheers are switched off for your profile.' }, { status: 403 });
  const body = (await readJson(req)) as { to?: unknown; kind?: unknown } | undefined;
  const to = typeof body?.to === 'string' ? body.to : '';
  const kind = body?.kind as CheerKind;
  if (!to || !(kind in CHEERS)) return badRequest('Send { to, kind }.');
  const result = await repo.sendCheer(auth.user.id, to, kind);
  if (result === 'self') return badRequest('You can’t cheer yourself.');
  if (result === 'no-user') return Response.json({ error: 'That classmate no longer exists.' }, { status: 404 });
  return ok({ ok: true, already: result === 'already' });
}
