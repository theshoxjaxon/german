import { badRequest, ok, readJson } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';
import { isValidId, sanitizeCard } from '@/lib/server/validate';
import type { CardDoc } from '@/lib/types';

const MAX_CARDS = 5000;

/**
 * POST /api/cards/import { cards: { [wordId]: CardDoc }, prefs? }
 * Brings the progress someone made as a guest (saved in their browser) into their profile.
 * Words already studied in the profile keep the profile's progress.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { cards?: unknown; prefs?: unknown } | undefined;
  if (!body || typeof body.cards !== 'object' || body.cards === null || Array.isArray(body.cards)) return badRequest('Expected { cards }.');
  const entries = Object.entries(body.cards as Record<string, unknown>);
  if (entries.length > MAX_CARDS) return badRequest('Too many cards.');
  const cards: Record<string, CardDoc> = {};
  for (const [id, raw] of entries) {
    const doc = isValidId(id) ? sanitizeCard(raw) : null;
    if (doc) cards[id] = doc;
  }
  const imported = await repo.importCards(auth.user.id, cards, body.prefs);
  return ok({ imported });
}
