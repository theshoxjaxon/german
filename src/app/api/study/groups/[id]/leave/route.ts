import { ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { leaveGroup } from '@/lib/server/study';
import { noGroup } from '@/lib/server/study-route';

/** POST /api/study/groups/:id/leave → leave the group; you can't read its chat any more. */
export async function POST(req: Request, ctx: RouteContext<'/api/study/groups/[id]/leave'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  return (await leaveGroup((await ctx.params).id, auth.user.id)) ? ok() : noGroup();
}
