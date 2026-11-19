import { AiError, aiEnabled } from '@/lib/server/ai';
import { checkPerfektText, MAX_TEXT, MIN_TEXT } from '@/lib/server/ai-perfekt';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { requireUser } from '@/lib/server/session';
import { HOUR } from '@/lib/time';
import { UI_LANGS, type UiLang } from '@/lib/types';

/**
 * POST /api/grammar/perfekt/check { text, lang } → the AI's check of a few sentences in the
 * Perfekt: mistakes with the rule behind each (in `lang`), the corrected text, how many
 * sentences used the Perfekt right, and a tip. 8 checks an hour; nothing is stored.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  if (!aiEnabled()) return Response.json({ error: 'The AI helper isn’t switched on for this app.' }, { status: 503 });
  const body = (await readJson(req)) as { text?: unknown; lang?: unknown } | undefined;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (text.length < MIN_TEXT) return badRequest('Write a few sentences first.');
  if (text.length > MAX_TEXT) return badRequest('That’s too long. Write 3–5 sentences.');
  const lang: UiLang = UI_LANGS.includes(body?.lang as UiLang) ? (body!.lang as UiLang) : 'en';
  if (!(await hit(`grammar-check:${auth.user.id}`, 8, HOUR))) {
    return Response.json({ error: 'You’ve asked for a lot of checks this hour. Try again later.' }, { status: 429 });
  }
  try {
    return ok({ check: await checkPerfektText(text, lang) });
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
    return Response.json({ error: e.message }, { status: e.status });
  }
}
