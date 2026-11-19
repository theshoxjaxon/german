import { connection } from 'next/server';
import { ok } from '@/lib/server/http';
import { currentCourse } from '@/lib/server/course';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';
import { testsFor } from '@/lib/server/tests';

/**
 * GET /api/courses → the courses to pick on the welcome page (name, language, word and test
 * counts) and the one this visitor studies now, for "Continue". Anyone may ask.
 */
export async function GET() {
  await connection(); // per visitor, never prerendered at build time
  const [courses, current, user] = await Promise.all([repo.listCourses(), currentCourse(), currentUser()]);
  return ok({
    courses: courses.map((c) => ({ ...c, tests: testsFor(c.id).length })),
    current: courses.some((c) => c.id === current) ? current : null,
    signedIn: !!user,
  });
}
