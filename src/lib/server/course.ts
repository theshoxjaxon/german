/**
 * The course a guest picked (or the course a link like /c/english opened), remembered in a
 * cookie so signing up lands them in it. Signed-in people's course is on their profile instead.
 */
import { cookies } from 'next/headers';
import { COURSE_COOKIE, isCourseId } from '../courses';

export async function chosenCourse(): Promise<string | null> {
  const v = (await cookies()).get(COURSE_COOKIE)?.value;
  return isCourseId(v) ? v : null;
}
