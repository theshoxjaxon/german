import { timingSafeEqual } from 'node:crypto';
import { ok } from '@/lib/server/http';
import { coursesToMatch, matchDue, purgeStudy } from '@/lib/server/study';

/**
 * GET /api/cron/study: Vercel's Sunday job (vercel.json, 18:00 in Tashkent). Makes the week's
 * study groups in every course with sign-ups and deletes old ones. Only with the CRON_SECRET
 * Vercel sends; without the secret set it does nothing (the first visit after 18:00 does the
 * matching instead).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) {
    return Response.json({ error: 'Not allowed.' }, { status: 401 });
  }
  const now = Date.now();
  const groups = await matchDue(await coursesToMatch(now), now);
  await purgeStudy(now);
  return ok({ groups });
}
