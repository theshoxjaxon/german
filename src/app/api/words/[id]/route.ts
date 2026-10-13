import { badRequest, ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { isValidId, sanitizeWord } from '@/lib/server/validate';
import { MAX_OWN_WORDS } from '@/lib/types';

const forbidden = (role: string) =>
  Response.json(
    { error: role === 'admin' ? 'This is a student’s own word. Only they can change it.' : 'Only your teacher can change lesson words. You can change your own words.' },
    { status: 403 },
  );

/**
 * PUT /api/words/:id creates or replaces a word. Ids come from the client, so retries are safe.
 * Admins write shared lesson words; everyone else writes their own words.
 */
export async function PUT(req: Request, ctx: RouteContext<'/api/words/[id]'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  const data = sanitizeWord(await readJson(req));
  if (!data) return badRequest('A word needs a term and a meaning.');
  const result = await repo.saveWord(repo.ownerFor(auth.user), id, data);
  if (result === 'forbidden') return forbidden(auth.user.role);
  if (result === 'limit') return badRequest(`You can have up to ${MAX_OWN_WORDS} of your own words.`);
  return ok();
}

/** DELETE /api/words/:id removes a word you may change, with everyone's progress on it. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/words/[id]'>) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  if (!isValidId(id)) return badRequest('Invalid word id.');
  if ((await repo.deleteWord(repo.ownerFor(auth.user), id)) === 'forbidden') return forbidden(auth.user.role);
  return ok();
}
