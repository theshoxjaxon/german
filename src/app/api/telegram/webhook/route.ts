import { appUrl } from '@/lib/server/mail';
import { handleUpdate } from '@/lib/server/reminders';
import { botConfig, hasSecret } from '@/lib/server/telegram';

/**
 * POST /api/telegram/webhook: Telegram delivers the bot's updates here (set up from /admin).
 * Only requests carrying TELEGRAM_WEBHOOK_SECRET in X-Telegram-Bot-Api-Secret-Token are real;
 * anything else gets 401 and is never read. A real update is always answered with 200, even
 * when handling it failed, or Telegram would keep re-sending it.
 */
export async function POST(req: Request) {
  if (!hasSecret(req.headers.get('x-telegram-bot-api-secret-token'), botConfig())) {
    return Response.json({ error: 'Not allowed.' }, { status: 401 });
  }
  const update = await req.json().catch(() => null);
  try {
    await handleUpdate(update, await appUrl());
  } catch (e) {
    console.error('Karteikasten: a Telegram update failed:', (e as Error).message);
  }
  return Response.json({ ok: true });
}
