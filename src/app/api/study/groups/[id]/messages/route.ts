import { ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { requireUser } from '@/lib/server/session';
import { addMessage, listMessages, memberGroup } from '@/lib/server/study';
import { noGroup } from '@/lib/server/study-route';
import { checkMessage } from '@/lib/study/text';
import { DAY, MIN } from '@/lib/time';

/** GET /api/study/groups/:id/messages?after=<id> → the newer messages, for the group's current members only. */
export async function GET(req: Request, ctx: RouteContext<'/api/study/groups/[id]/messages'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const after = Number(new URL(req.url).searchParams.get('after') ?? 0);
  const messages = await listMessages((await ctx.params).id, auth.user.id, Number.isSafeInteger(after) && after > 0 ? after : 0);
  return messages ? ok({ messages }) : noGroup();
}

/** POST /api/study/groups/:id/messages { body } → post plain text to your group (no links or contact details). */
export async function POST(req: Request, ctx: RouteContext<'/api/study/groups/[id]/messages'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  const id = (await ctx.params).id;
  const group = await memberGroup(id, user.id);
  if (!group) return noGroup();
  if (!group.open) return Response.json({ error: 'This group’s week is over, so its chat is read-only.' }, { status: 409 });
  if (!(await hit(`study-msg:${user.id}`, 20, MIN)) || !(await hit(`study-msg-day:${user.id}`, 300, DAY))) {
    return Response.json({ error: 'You’re sending messages very fast. Wait a moment.' }, { status: 429 });
  }
  const check = checkMessage(((await readJson(req)) as { body?: unknown } | undefined)?.body);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  const message = await addMessage(id, user.id, check.body);
  return message ? ok({ message }) : noGroup();
}
