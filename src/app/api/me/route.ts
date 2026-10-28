import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/**
 * GET /api/me → { me }: who is signed in (name, photo, role, how they log in), or 401.
 * Email addresses are for admins only, so a student's own isn't included either.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  return ok({ me: repo.publicUser(auth.user) });
}
