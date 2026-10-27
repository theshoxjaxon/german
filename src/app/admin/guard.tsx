import { redirect } from 'next/navigation';
import { describeDbError } from '@/lib/server/db-health';
import type * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';

/**
 * The real check for the admin pages (the proxy only looks for a cookie), plus loading the
 * page's data. Signed out → login; not an admin → the app. When the database can't be reached,
 * `down` says why, so the page can explain it instead of failing.
 */
export async function adminData<T>(path: string, load: () => Promise<T>): Promise<{ user: repo.UserRow; data: T } | { down: string }> {
  let user: repo.UserRow | null;
  let data: T | undefined;
  try {
    user = await currentUser();
    if (user?.role === 'admin') data = await load();
  } catch (e) {
    const { problem, message } = describeDbError(e);
    console.error(`Karteikasten: database unavailable (${problem}). ${message}`);
    return { down: message }; // the message never contains the connection string
  }
  // Outside the try: redirect() works by throwing
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (user.role !== 'admin' || data === undefined) redirect('/');
  return { user, data };
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
