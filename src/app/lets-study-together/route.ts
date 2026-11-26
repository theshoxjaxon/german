import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

/** A short link for sharing: opens your course's "Study together" section. */
export async function GET(req: Request) {
  const r = await api<{ current: string | null }>('/courses').catch(() => null);
  return NextResponse.redirect(new URL(`/${(r?.ok && r.data.current) || 'german'}#study`, req.url), 303);
}
