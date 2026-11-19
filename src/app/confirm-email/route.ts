import { adoptChosenCourse } from '@/lib/server/course';
import { clientIp, hit } from '@/lib/server/rate-limit';
import * as repo from '@/lib/server/repo';
import { startSession } from '@/lib/server/session';
import { MIN } from '@/lib/time';

/**
 * GET /confirm-email?token=… : the link in the sign-up email. A good link confirms the address,
 * logs this browser in and opens the app. An old or used link goes to the log-in page, which
 * says what to do (a confirmed address simply logs in).
 */
export async function GET(req: Request) {
  const go = (path: string) => new Response(null, { status: 303, headers: { Location: new URL(path, req.url).toString(), 'Cache-Control': 'no-store' } });
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[\w-]{20,200}$/.test(token)) return go('/login?confirm=expired');
  try {
    if (!(await hit(`confirm:use:${await clientIp()}`, 30, 15 * MIN))) return go('/login?confirm=expired');
    const user = await repo.useConfirmToken(token);
    if (!user) return go('/login?confirm=expired');
    await repo.ensureAdminRole(user); // the link proved the address
    await adoptChosenCourse(user.id);
    await startSession(user.id);
  } catch {
    return go('/login?confirm=error');
  }
  return go('/app?joined=email'); // into the course they signed up for (counted once by Metrica)
}
