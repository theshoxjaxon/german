import { ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { rsvpClub, upcomingClubs } from '@/lib/server/study';

/** POST /api/study/clubs/:id/rsvp { going } → "I'll come" (or not) to a speaking club of your course. */
export async function POST(req: Request, ctx: RouteContext<'/api/study/clubs/[id]/rsvp'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  const going = ((await readJson(req)) as { going?: unknown } | undefined)?.going === true;
  if (!user.member || !(await rsvpClub((await ctx.params).id, user.id, user.courseId, going))) {
    return Response.json({ error: 'That speaking club doesn’t exist any more.' }, { status: 404 });
  }
  return ok({ clubs: await upcomingClubs(user.courseId, user.id) });
}
