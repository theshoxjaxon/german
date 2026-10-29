import Link from 'next/link';
import { redirect } from 'next/navigation';
import { describeDbError } from '@/lib/server/db-health';
import type * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';

/**
 * The real check for the admin pages (the proxy only looks for a cookie), plus loading the
 * page's data. Signed out → login. Signed in without admin rights → `student` (the name), so
 * the page can say why instead of silently sending you back to the app. When the database
 * can't be reached, `down` says why.
 */
export async function adminData<T>(
  path: string,
  load: (user: repo.UserRow) => Promise<T>,
): Promise<{ user: repo.UserRow; data: T } | { down: string } | { student: string }> {
  let user: repo.UserRow | null;
  let data: T | undefined;
  try {
    user = await currentUser();
    if (user?.role === 'admin') data = await load(user);
  } catch (e) {
    const { problem, message } = describeDbError(e);
    console.error(`Karteikasten: database unavailable (${problem}). ${message}`);
    return { down: message }; // the message never contains the connection string
  }
  // Outside the try: redirect() works by throwing
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (user.role !== 'admin') return { student: user.displayName };
  return { user, data: data as T };
}

/** A signed-in student opened an admin page: say so, and how the person running the app becomes admin. */
export function NotAdmin({ name }: { name: string }) {
  return (
    <div className="admin-main">
      <div className="page admin-page">
        <div className="panel not-admin" role="alert">
          <h2>This page is for teachers</h2>
          <p>You’re signed in as <b>{name}</b>, which is a student account, so the dashboard and analytics stay closed.</p>
          <p className="hint">
            If you run this app: put this account’s email in <code>ADMIN_EMAILS</code> (Vercel → Settings → Environment Variables,
            then redeploy), and prove the address once: log in with <b>Continue with Google</b> using that email, or use
            <b> Forgot password</b> and open the emailed link. Signing up with email and password alone never makes an account admin,
            so nobody can take it by signing up with your address first. An admin can also make others admin under Manage.
          </p>
          <p><Link className="btn" href="/">Back to the app</Link></p>
        </div>
      </div>
    </div>
  );
}

export function DatabaseDown({ message }: { message: string }) {
  return (
    <div className="admin-main">
      <div className="page admin-page">
        <div className="panel" role="alert">
          <h2>The database isn’t reachable</h2>
          <p className="err">{message}</p>
          <p className="hint">After fixing it, reload this page or open <a href="/api/health">/api/health</a> to check.</p>
        </div>
      </div>
    </div>
  );
}
