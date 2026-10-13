import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/**
 * GET /api/state → you, the shared words and your own words, your progress, your settings and new cheers for you.
 * Not signed in → { me: null, words }: guests practise the flashcards and keep their progress
 * in their own browser.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) {
    if (auth.response.status !== 401) return auth.response;
    return ok({ me: null, words: await repo.listWords(null) });
  }
  const { user } = auth;
  const [words, cards, prefs, cheers] = await Promise.all([
    repo.listWords(user.id),
    repo.listCards(user.id),
    repo.getPrefs(user.id),
    repo.unseenCheers(user.id),
  ]);
  return ok({ me: repo.publicUser(user), words, cards, prefs, cheers });
}
