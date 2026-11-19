import { badRequest, ok, readJson } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { blockMember } from '@/lib/server/study';
import { noGroup } from '@/lib/server/study-route';

/** POST /api/study/groups/:id/block { member } → never be in a group with this member again. */
export async function POST(req: Request, ctx: RouteContext<'/api/study/groups/[id]/block'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const member = ((await readJson(req)) as { member?: unknown } | undefined)?.member;
  if (typeof member !== 'string' || !member) return badRequest('Send { member }.');
  return (await blockMember((await ctx.params).id, auth.user.id, member)) ? ok() : noGroup();
}
