import { mutate } from '@/lib/server/db';
import { ok } from '@/lib/server/http';

/** DELETE /api/cards resets all progress. Words stay. */
export async function DELETE() {
  await mutate((data) => {
    data.cards = {};
  });
  return ok();
}
