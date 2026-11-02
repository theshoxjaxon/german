import { badRequest, ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { requireUser } from '@/lib/server/session';
import { reportMember } from '@/lib/server/study';
import { noGroup } from '@/lib/server/study-route';
import { isReason } from '@/lib/study/types';
import { DAY } from '@/lib/time';

/**
 * POST /api/study/groups/:id/report { member, reason } → tell the teacher who and why (never the
 * messages), and block that member.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/study/groups/[id]/report'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { member?: unknown; reason?: unknown } | undefined;
  if (typeof body?.member !== 'string' || !isReason(body.reason)) return badRequest('Send { member, reason }.');
  if (!(await hit(`study-report:${auth.user.id}`, 10, DAY))) return Response.json({ error: 'Too many reports today. Talk to your teacher.' }, { status: 429 });
  return (await reportMember((await ctx.params).id, auth.user.id, body.member, body.reason)) ? ok() : noGroup();
}
