import { NextResponse } from 'next/server';
import { isCourseId } from '@/lib/courses';
import { chooseCourse } from '@/lib/server/course';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';

/**
 * The old course link: /c/english opens the app in that course (now at /english). Guests' browsers
 * remember it (and signing up puts them in it); signed-in people join it and switch to it. An
 * unknown course opens the welcome page.
 */
export async function GET(req: Request, ctx: RouteContext<'/c/[slug]'>) {
  const { slug } = await ctx.params;
  if (!isCourseId(slug) || !(await repo.getCourse(slug))) return NextResponse.redirect(new URL('/', req.url), 303);
  const user = await currentUser();
  if (user) await repo.joinCourse(user.id, slug);
  else await chooseCourse(slug);
  // Permanent: old shared links pass their value to the course's own address
  return NextResponse.redirect(new URL(`/${slug}`, req.url), 308);
}
