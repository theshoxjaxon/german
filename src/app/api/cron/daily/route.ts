import { timingSafeEqual } from 'node:crypto';
import { postDailyQuiz } from '@/lib/server/channel';
import { ok } from '@/lib/server/http';
import { appUrl } from '@/lib/server/mail';
import { sendDailyReminders } from '@/lib/server/reminders';

// Sending to many people takes a while: allow up to a minute
export const maxDuration = 60;

/**
 * GET /api/cron/daily: Vercel's evening job (vercel.json, 19:00 in Tashkent). Sends the Telegram
 * reminders and posts the day's der/die/das quiz in the channel. Only with the CRON_SECRET Vercel
 * sends. Each part fails on its own: a channel problem never stops the reminders.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret ?? ''}`);
  if (!secret || given.length !== want.length || !timingSafeEqual(given, want)) {
    return Response.json({ error: 'Not allowed.' }, { status: 401 });
  }
  const base = await appUrl();
  const failed = (e: unknown) => ({ error: (e as Error).message });
  const [reminders, quiz] = await Promise.all([
    sendDailyReminders(base).catch(failed),
    postDailyQuiz(base).catch(failed),
  ]);
  return ok({ reminders, quiz });
}
