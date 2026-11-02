import { NextResponse } from 'next/server';

/** /lets-study-together: a link to share. Opens the app on the study-together page (Class tab). */
export function GET(req: Request) {
  return NextResponse.redirect(new URL('/#study', req.url), 303);
}
