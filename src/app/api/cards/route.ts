import { ok } from '@/lib/server/http';
import * as repo from '@/lib/server/repo';
import { requireUser } from '@/lib/server/session';

/** DELETE /api/cards resets your progress in your active course. Words stay, and so do other courses. */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  await repo.deleteAllCards(auth.user.id, auth.user.courseId);
  return ok();
}
