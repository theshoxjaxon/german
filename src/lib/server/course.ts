/**
 * The course a guest picked (or the course a link like /c/english opened), remembered in a
 * cookie so that signing up or logging in lands them in it. Signed-in people's course is on
 * their profile instead, so the cookie is cleared once a profile has taken it over: on a shared
 * computer, the next person to log in keeps their own course.
 */
import { cookies } from 'next/headers';
import { COURSE_COOKIE, isCourseId } from '../courses';
import { DAY } from '../time';
import * as repo from './repo';
import { currentUser, isHttps } from './session';

export async function chosenCourse(): Promise<string | null> {
  const v = (await cookies()).get(COURSE_COOKIE)?.value;
  return isCourseId(v) ? v : null;
}

/** Remember a guest's course in this browser for a year. */
export async function chooseCourse(courseId: string): Promise<void> {
  (await cookies()).set(COURSE_COOKIE, courseId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isHttps(),
    path: '/',
    maxAge: (365 * DAY) / 1000,
  });
}

/** The course this visitor studies: a signed-in person's active course, else the one this browser picked. */
export async function currentCourse(): Promise<string | null> {
  const user = await currentUser();
  return user ? user.courseId : chosenCourse();
}

/** After signing in: switch to the course this browser picked as a guest, if any, then forget it. */
export async function adoptChosenCourse(userId: string): Promise<void> {
  const courseId = await chosenCourse();
  if (!courseId) return;
  await repo.joinCourse(userId, courseId);
  (await cookies()).delete(COURSE_COOKIE);
}
