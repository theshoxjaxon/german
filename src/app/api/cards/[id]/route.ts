import { badRequest, ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { isValidId, sanitizeCard } from '@/lib/server/validate';

/** PUT /api/cards/:wordId saves your progress on one word (both card directions). */
export async function PUT(req: Request, ctx: RouteContext<'/api/cards/[id]'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  const card = sanitizeCard(await readJson(req));
  if (!card) return badRequest('Invalid progress data.');
  if ((await repo.putCard(auth.user.id, id, card)) === 'no-word') return Response.json({ error: 'That word no longer exists.' }, { status: 404 });
  return ok();
}

/** DELETE /api/cards/:wordId resets one word to New for you. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/cards/[id]'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  await repo.putCard(auth.user.id, id, null);
  return ok();
}
