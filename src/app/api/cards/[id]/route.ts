import { mutate } from '@/lib/server/db';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { isValidId, sanitizeCard } from '@/lib/server/validate';

/** PUT /api/cards/:wordId saves the progress for one word (both card directions). */
export async function PUT(req: Request, ctx: RouteContext<'/api/cards/[id]'>) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  const card = sanitizeCard(await readJson(req));
  if (!card) return badRequest('Invalid progress data.');
  await mutate((data) => {
    data.cards[id] = card;
  });
  return ok();
}

/** DELETE /api/cards/:wordId resets one word to New. */
export async function DELETE(_req: Request, ctx: RouteContext<'/api/cards/[id]'>) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  await mutate((data) => {
    delete data.cards[id];
  });
  return ok();
}
