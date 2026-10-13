import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/** POST /api/cheers/seen marks the cheers you received as read. */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  await repo.markCheersSeen(auth.user.id);
  return ok();
}
