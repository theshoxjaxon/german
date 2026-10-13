import { AI_IMAGE_TYPES, AI_MAX_IMAGE_CHARS, AI_MAX_LINES, AI_MAX_TEXT, isAiLanguage, type AiImageType, type AiRequest } from '@/lib/ai-shared';
import { aiEnabled, AiError, makeWords } from '@/lib/server/ai';
import { badRequest, ok, readJson } from '@/lib/server/http';
import { hit } from '@/lib/server/rate-limit';
import { requireUser } from '@/lib/server/session';
import { HOUR } from '@/lib/time';

// Reading a full page of words can take a while.
export const maxDuration = 120;

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * POST /api/ai/words { mode: 'photo' | 'text', language, image?: { data, mediaType }, text? }
 * → { topic, note, words }: suggested flashcards. Nothing is saved; the person reviews them first.
 * Signed-in people only, with an hourly limit (each call costs money).
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  if (!aiEnabled()) return fail(503, 'The AI helper isn’t switched on for this app.');

  const body = (await readJson(req)) as Partial<AiRequest> | undefined;
  if (!body || (body.mode !== 'photo' && body.mode !== 'text') || !isAiLanguage(body.language)) {
    return badRequest('Send { mode: "photo" | "text", language, image | text }.');
  }
  const request: AiRequest = { mode: body.mode, language: body.language };
  if (body.mode === 'photo') {
    const image = body.image;
    if (!image || typeof image.data !== 'string' || !image.data || !AI_IMAGE_TYPES.includes(image.mediaType as AiImageType)) {
      return badRequest('Choose a photo (JPEG, PNG, WebP or GIF).');
    }
    if (image.data.length > AI_MAX_IMAGE_CHARS) return badRequest('That photo is too large.');
    request.image = { data: image.data, mediaType: image.mediaType as AiImageType };
  } else {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return badRequest('Type at least one German word.');
    if (text.length > AI_MAX_TEXT || text.split('\n').length > AI_MAX_LINES) {
      return badRequest(`Send up to ${AI_MAX_LINES} words at a time.`);
    }
    request.text = text;
  }

  const { user } = auth;
  if (!hit(`ai:${user.id}`, user.role === 'admin' ? 60 : 20, HOUR)) {
    return fail(429, 'You’ve used the AI helper a lot this hour. Try again later, or add words by hand.');
  }
  try {
    return ok(await makeWords(request));
  } catch (e) {
    if (e instanceof AiError) return fail(e.status, e.message);
    throw e;
  }
}
