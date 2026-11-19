import { badRequest, ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { createLink, setReminders, telegramState, unlink } from '@/lib/server/reminders';
import { requireUser } from '@/lib/server/session';
import { botConfig } from '@/lib/server/telegram';

const HOUR = 3_600_000;

/** GET /api/telegram → { available, linked, reminders }: the Telegram section in Settings. */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  return ok(await telegramState(auth.user.id));
}

/**
 * POST /api/telegram
 *   { action: 'link' }       → { url }: a one-time t.me link; pressing Start in Telegram connects this profile
 *   { reminders: boolean }   → turn the evening reminder on or off
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const body = (await readJson(req)) as { action?: unknown; reminders?: unknown } | null;
  if (body?.action === 'link') {
    const cfg = botConfig();
    if (!cfg) return Response.json({ error: 'Telegram reminders aren’t set up on this server yet.' }, { status: 503 });
    if (!(await hit(`tg-link:${auth.user.id}`, 10, HOUR))) return Response.json({ error: 'Too many tries. Wait a little, then try again.' }, { status: 429 });
    return ok({ url: await createLink(auth.user.id, cfg) });
  }
  if (typeof body?.reminders === 'boolean') {
    if (!(await setReminders(auth.user.id, body.reminders))) return badRequest('Connect Telegram first.');
    return ok(await telegramState(auth.user.id));
  }
  return badRequest('Unknown request.');
}

/** DELETE /api/telegram → disconnect: the chat is forgotten. */
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  await unlink(auth.user.id);
  return ok(await telegramState(auth.user.id));
}
