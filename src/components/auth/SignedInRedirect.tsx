import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { safeNext } from '@/lib/account-rules';
import { currentUser } from '@/lib/server/session';

/**
 * For /login, /signup and /forgot-password: already signed in, there is nothing to do here, so
 * go on to the app (or to ?next). Checks the session for real, not just the cookie, so a stale
 * cookie never locks anyone out of the login page. Render it inside <Suspense>: it reads the request.
 */
export async function SignedInRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  let signedIn = false;
  try {
    signedIn = !!(await currentUser());
  } catch {
    return null; // the database is down: let the page show (its form explains the problem)
  }
  if (signedIn) redirect(safeNext((await searchParams).next));
  return null;
}
