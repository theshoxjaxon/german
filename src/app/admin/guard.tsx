import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Course } from '@/lib/courses';
import { describeDbError } from '@/lib/server/db-health';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';

/** Who is looking at an admin page, and which course: admins run every course, teachers theirs. */
export interface AdminContext {
  user: repo.UserRow;
  admin: boolean; // runs the whole app: sees email addresses, makes teachers and courses
  course: Course; // the course shown
  courses: Course[]; // the ones this person may pick
}

/**
 * The real check for the admin pages (the proxy only looks for a cookie), plus loading the
 * page's data for one course: `wanted` (the ?course= of the page), else your active course,
 * else the first one you teach. Signed out → login. Signed in without a course to run →
 * `student` (the name), so the page can say why instead of silently sending you back to the
 * app. When the database can't be reached, `down` says why.
 */
export async function adminData<T>(
  path: string,
  wanted: string | string[] | undefined,
  load: (ctx: AdminContext) => Promise<T>,
): Promise<(AdminContext & { data: T }) | { down: string } | { student: string }> {
  let user: repo.UserRow | null;
  let ctx: AdminContext | null = null;
  let data: T | undefined;
  try {
    user = await currentUser();
    const courses = user ? await repo.taughtCourses(user) : [];
    const course = courses.find((c) => c.id === wanted) ?? courses.find((c) => c.id === user?.courseId) ?? courses[0];
    if (user && course) {
      ctx = { user, admin: user.role === 'admin', course, courses };
      data = await load(ctx);
    }
  } catch (e) {
    const { problem, message } = describeDbError(e);
    console.error(`Karteikasten: database unavailable (${problem}). ${message}`);
    return { down: message }; // the message never contains the connection string
  }
  // Outside the try: redirect() works by throwing
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!ctx) return { student: user.displayName };
  return { ...ctx, data: data as T };
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
            so nobody can take it by signing up with your address first. An admin can also make others admin, or a course’s teacher, under Manage.
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
