import { endSession, sameOrigin } from '@/lib/server/session';

/**
 * POST /api/logout → sign out this browser, then load the login page.
 * A plain form post (not a Server Action) on purpose: the full page load drops every bit of
 * the old profile's data from memory, which matters on computers students share.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Cross-site request blocked.' }, { status: 403 });
  await endSession();
  return new Response(null, { status: 303, headers: { Location: '/login', 'Cache-Control': 'no-store' } });
}
