import { NextResponse } from 'next/server';
import { currentCourse } from '@/lib/server/course';

/** /lets-study-together: a link to share. Opens your course on its study-together page (Class tab). */
export async function GET(req: Request) {
  const course = await currentCourse();
  // Without a course yet, the German one (where study groups started); the course page asks nothing more
  return NextResponse.redirect(new URL(`/${course ?? 'german'}#study`, req.url), 303);
}
