import { NextResponse } from 'next/server';
import { isCourseId } from '@/lib/courses';
import { chooseCourse } from '@/lib/server/course';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';

/**
 * A course's invite link: /c/english opens the app in that course. Guests' browsers remember it
 * (and signing up puts them in it); signed-in people join it and switch to it. An unknown course
 * just opens the app.
 */
export async function GET(req: Request, ctx: RouteContext<'/c/[slug]'>) {
  const { slug } = await ctx.params;
  const home = NextResponse.redirect(new URL('/', req.url), 303);
  if (!isCourseId(slug) || !(await repo.getCourse(slug))) return home;
  const user = await currentUser();
  if (user) await repo.joinCourse(user.id, slug);
  else await chooseCourse(slug);
  return home;
}
