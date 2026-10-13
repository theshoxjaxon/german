import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/** GET /api/state → you, the shared words, your progress, your settings and new cheers for you. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const { user } = auth;
  const [words, cards, prefs, cheers] = await Promise.all([
    repo.listWords(),
    repo.listCards(user.id),
    repo.getPrefs(user.id),
    repo.unseenCheers(user.id),
  ]);
  return ok({ me: repo.publicUser(user), words, cards, prefs, cheers });
}
