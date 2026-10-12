import { mutate } from '@/lib/server/db';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { isValidId, sanitizeWord } from '@/lib/server/validate';
import type { Word } from '@/lib/types';

/** POST /api/words { words: [{ id, term, meaning, … }] } adds many words in one write (used by Import). */
export async function POST(req: Request) {
  const body = (await readJson(req)) as { words?: unknown } | undefined;
  if (!body || !Array.isArray(body.words) || body.words.length > 1000) return badRequest('Send { words: [...] } with up to 1000 words.');
  const clean: Word[] = [];
  for (const raw of body.words) {
    const id = (raw as { id?: unknown })?.id;
    const word = sanitizeWord(raw);
    if (!isValidId(id) || !word) return badRequest('Every word needs a valid id, a term and a meaning.');
    clean.push({ ...word, id });
  }
  await mutate((data) => {
    for (const w of clean) data.words[w.id] = w;
  });
  return ok({ ok: true, count: clean.length });
}
