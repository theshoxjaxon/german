import { api, relayCookies } from '@/lib/api';

/**
 * The link in the confirmation email. The API checks it, confirms the address and signs the
 * person in; this route hands on the session cookie and sends the browser where the API says.
 */
export async function GET(req: Request) {
  const go = (path: string) => new Response(null, { status: 303, headers: { Location: new URL(path, req.url).toString(), 'Cache-Control': 'no-store' } });
  const token = new URL(req.url).searchParams.get('token') ?? '';
  try {
    const r = await api<{ redirect?: string }>(`/auth/confirm?token=${encodeURIComponent(token)}`);
    if (!r.ok) return go('/login?confirm=error');
    await relayCookies(r.setCookies);
    return go(r.data.redirect ?? '/login?confirm=error');
  } catch {
    return go('/login?confirm=error');
  }
}
