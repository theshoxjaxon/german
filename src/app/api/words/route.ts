import { badRequest, ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { isValidId, sanitizeWord } from '@/lib/server/validate';
import type { Word } from '@/lib/types';

/** POST /api/words { words: [{ id, term, meaning, … }] } adds many words at once (Import, admins only). */
export async function POST(req: Request) {
  const auth = await requireUser(req, { admin: true });
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { words?: unknown } | undefined;
  if (!body || !Array.isArray(body.words) || body.words.length > 1000) return badRequest('Send { words: [...] } with up to 1000 words.');
  const clean: Word[] = [];
  for (const raw of body.words) {
    const id = (raw as { id?: unknown })?.id;
    const word = sanitizeWord(raw);
    if (!isValidId(id) || !word) return badRequest('Every word needs a valid id, a term and a meaning.');
    clean.push({ ...word, id });
  }
  await repo.putWords(clean);
  return ok({ ok: true, count: clean.length });
}
