import { NextResponse } from 'next/server';
import { isCourseId } from '@/lib/courses';
import { api, relayCookies } from '@/lib/api';

/**
 * /c/<course>: a link to a course. Signed in → you join it; a guest → their browser remembers it
 * (the API does both). Then on to the course page. An unknown link goes to the home page.
 */
export async function GET(req: Request, ctx: RouteContext<'/c/[slug]'>) {
  const { slug } = await ctx.params;
  if (!isCourseId(slug)) return NextResponse.redirect(new URL('/', req.url), 303);
  const r = await api('/course', { method: 'POST', body: { id: slug } });
  if (!r.ok) return NextResponse.redirect(new URL('/', req.url), 303);
  await relayCookies(r.setCookies);
  return NextResponse.redirect(new URL(`/${slug}`, req.url), 308);
}
