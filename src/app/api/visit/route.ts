import { badRequest, readJson } from '@/lib/server/http';
import { clientIp, hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { VISITOR_RE } from '@/lib/text';

/**
 * POST /api/visit { id, tried } counts a browser that opened the app without a profile (tried:
 * it answered a card as a guest). The id is random; see lib/client/visitor.ts.
 */
export async function POST(req: Request) {
  const body = (await readJson(req)) as { id?: unknown; tried?: unknown } | undefined;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!VISITOR_RE.test(id)) return badRequest('Send { id }.');
  if (!hit(`visit:${await clientIp()}`, 30, 60 * 60_000)) return new Response(null, { status: 429 });
  await repo.recordVisitor(id, body?.tried === true);
  return new Response(null, { status: 204 });
}
