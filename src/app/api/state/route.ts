import { aiEnabled } from '@/lib/server/ai';
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
    const [words, classLesson] = await Promise.all([repo.listWords(null), repo.getClassLesson()]);
    return ok({ me: null, words, classLesson });
  }
  const { user } = auth;
  const [words, cards, prefs, cheers, streak, classLesson] = await Promise.all([
    repo.listWords(user.id),
    repo.listCards(user.id),
    repo.getPrefs(user.id),
    repo.unseenCheers(user.id),
    repo.myStreak(user.id),
    repo.getClassLesson(),
  ]);
  // Everyone signed in gets the AI helper (it has an hourly limit per person, since each use costs money).
  return ok({ me: repo.publicUser(user), words, cards, prefs, cheers, ai: aiEnabled(), streak, classLesson });
}
