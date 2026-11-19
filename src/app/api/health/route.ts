import { connection } from 'next/server';
import { aiEnabled } from '@/lib/server/ai';
import { checkDatabase } from '@/lib/server/db-health';

/**
 * GET /api/health → is the app working, and if not, why? Open it in a browser after a deploy.
 * Shows no secrets: only whether the database answers and, if not, what to fix.
 */
export async function GET() {
  await connection(); // check on every request, never at build time
  const database = await checkDatabase();
  return Response.json(
    { ok: database.ok, database, ai: aiEnabled(), commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
    { status: database.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
