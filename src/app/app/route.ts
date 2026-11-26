import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

/** /app: straight into your course (the one you are in, or the one this browser picked); no course yet → the home page. */
export async function GET(req: Request) {
  const r = await api<{ current: string | null }>('/courses').catch(() => null);
  const course = r?.ok ? r.data.current : null;
  const url = new URL(course ? `/${course}` : '/', req.url);
  const joined = new URL(req.url).searchParams.get('joined');
  if (course && (joined === 'email' || joined === 'google')) url.searchParams.set('joined', joined);
  return NextResponse.redirect(url, 303);
}
