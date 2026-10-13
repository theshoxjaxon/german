import { badRequest, ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { isValidId, sanitizeWord } from '@/lib/server/validate';

/** PUT /api/words/:id creates or replaces a word (admins only). Ids come from the client, so retries are safe. */
export async function PUT(req: Request, ctx: RouteContext<'/api/words/[id]'>) {
  const auth = await requireUser(req, { admin: true });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  const word = sanitizeWord(await readJson(req));
  if (!word) return badRequest('A word needs a term and a meaning.');
  await repo.putWords([{ ...word, id }]);
  return ok();
}

/** DELETE /api/words/:id removes the word and everyone's progress on it (admins only). */
export async function DELETE(req: Request, ctx: RouteContext<'/api/words/[id]'>) {
  const auth = await requireUser(req, { admin: true });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  await repo.deleteWord(id);
  return ok();
}
