import { mutate } from '@/lib/server/db';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { isValidId, sanitizeWord } from '@/lib/server/validate';

/** PUT /api/words/:id creates or replaces a word. Ids come from the client, so retries are safe. */
export async function PUT(req: Request, ctx: RouteContext<'/api/words/[id]'>) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  const word = sanitizeWord(await readJson(req));
  if (!word) return badRequest('A word needs a term and a meaning.');
  await mutate((data) => {
    data.words[id] = { ...word, id };
  });
  return ok();
}

/** DELETE /api/words/:id removes the word and its progress. */
export async function DELETE(_req: Request, ctx: RouteContext<'/api/words/[id]'>) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  await mutate((data) => {
    delete data.words[id];
    delete data.cards[id];
  });
  return ok();
}
