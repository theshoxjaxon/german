import { badRequest, ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { isValidId, sanitizeWord } from '@/lib/server/validate';
import { MAX_OWN_WORDS, type WordData } from '@/lib/types';

/**
 * POST /api/words { words: [{ id, term, meaning, … }] } adds many words at once (Import).
 * Admins add shared lesson words; everyone else adds their own words, which only they see.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { words?: unknown } | undefined;
  if (!body || !Array.isArray(body.words) || body.words.length > 1000) return badRequest('Send { words: [...] } with up to 1000 words.');
  const clean: { id: string; data: WordData }[] = [];
  for (const raw of body.words) {
    const id = (raw as { id?: unknown })?.id;
    const data = sanitizeWord(raw);
    if (!isValidId(id) || !data) return badRequest('Every word needs a valid id, a term and a meaning.');
    clean.push({ id, data });
  }
  const owner = repo.ownerFor(auth.user);
  if (owner && (await repo.countOwnWords(owner)) + clean.length > MAX_OWN_WORDS) {
    return badRequest(`You can have up to ${MAX_OWN_WORDS} of your own words.`);
  }
  const count = await repo.putWords(owner, clean);
  return ok({ ok: true, count });
}
