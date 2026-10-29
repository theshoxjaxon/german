import { DEFAULT_COURSE } from '@/lib/courses';
import { aiEnabled } from '@/lib/server/ai';
import { chosenCourse } from '@/lib/server/course';
import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/**
 * GET /api/state → you, your course (and the list of courses), its shared words and your own
 * words in it, your progress on them, your settings and new cheers for you.
 * Not signed in → { me: null, words, course }: guests practise the flashcards of the course
 * they picked and keep their progress in their own browser. A guest who hasn't picked a
 * course yet (when there are several) gets course: null and no words.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) {
    if (auth.response.status !== 401) return auth.response;
    const [courses, chosen] = await Promise.all([repo.listCourses(), chosenCourse()]);
    const course = courses.find((c) => c.id === chosen) ?? (courses.length === 1 ? courses[0] : null);
    const words = course ? await repo.listWords(null, course.id) : {};
    return ok({ me: null, words, classLesson: course?.currentLesson ?? null, course, courses });
  }
  const { user } = auth;
  const [words, cards, prefs, cheers, streak, courses] = await Promise.all([
    repo.listWords(user.id, user.courseId),
    repo.listCards(user.id, user.courseId),
    repo.getPrefs(user.id),
    repo.unseenCheers(user.id),
    repo.myStreak(user.id),
    repo.listCourses(),
  ]);
  const course = courses.find((c) => c.id === user.courseId) ?? courses.find((c) => c.id === DEFAULT_COURSE) ?? courses[0];
  // Everyone signed in gets the AI helper (it has an hourly limit per person, since each use costs money).
  return ok({
    me: repo.publicUser(user), words, cards, prefs, cheers, ai: aiEnabled(), streak, classLesson: course?.currentLesson ?? null, course, courses,
  });
}
