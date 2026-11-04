import { NextResponse } from 'next/server';
import { currentCourse } from '@/lib/server/course';
import * as repo from '@/lib/server/repo';

/**
 * /app: straight into your course (/german, /english, …). The home-screen icon and logging in
 * land here; someone without a course yet gets the welcome page to pick one.
 */
export async function GET(req: Request) {
  const id = await currentCourse();
  const course = id ? await repo.getCourse(id) : null;
  const url = new URL(course ? `/${course.id}` : '/', req.url);
  return NextResponse.redirect(url, 303);
}
