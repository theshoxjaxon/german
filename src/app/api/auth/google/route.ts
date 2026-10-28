import { z } from 'zod';
import { safeNext } from '@/lib/account-rules';
import { describeDbError } from '@/lib/server/db-health';
import { googleClientId, verifyGoogleCredential } from '@/lib/server/google';
import { readJson } from '@/lib/server/http';
import { clientIp, hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { sameOrigin, startSession } from '@/lib/server/session';
import { VISITOR_RE } from '@/lib/text';
import { MIN } from '@/lib/time';

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

const body = z.object({
  credential: z.string().min(20).max(8192), // the ID token (a JWT) from the Google button
  next: z.string().max(500).optional(),
  visitor: z.string().regex(VISITOR_RE).optional().catch(undefined),
});

/**
 * POST /api/auth/google { credential, next?, visitor? } → { next }: signs you in with Google.
 * Your first time, it makes your profile, or links the one that already has your email.
 * JSON only and same-origin only: another site can't post here (a plain form can't send JSON).
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, 'Cross-site request blocked.');
  if (!req.headers.get('content-type')?.startsWith('application/json')) return fail(415, 'Send JSON.');
  if (!googleClientId()) return fail(503, 'Google sign-in isn’t set up on this server.');
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, 'Google sign-in failed. Try again.');
  const { credential, next, visitor } = parsed.data;

  try {
    if (!(await hit(`google:ip:${await clientIp()}`, 30, 15 * MIN))) return fail(429, 'Too many attempts. Wait 15 minutes, then try again.');
    let profile: repo.GoogleProfile;
    try {
      profile = await verifyGoogleCredential(credential);
    } catch (e) {
      console.warn('Karteikasten: a Google token was refused.', (e as Error).message);
      return fail(401, 'Google sign-in failed. Try again.');
    }
    const result = await repo.googleSignIn(profile, { visitorId: visitor });
    if (result === 'unverified') return fail(403, 'Google hasn’t verified this email address, so it can’t be used here.');
    if (result === 'other-google') return fail(409, 'This email is linked to a different Google account. Log in with your password instead.');
    const user = await repo.ensureAdminRole(result.user);
    await startSession(user.id);
    return Response.json({ next: safeNext(next), created: result.created }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const { problem, message } = describeDbError(e);
    console.error(`Karteikasten: Google sign-in failed (${problem}). ${message}`);
    return fail(503, 'The app can’t reach its database right now. Please try again in a few minutes.');
  }
}
