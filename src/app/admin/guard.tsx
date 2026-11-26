import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Course } from '@/lib/courses';
import { api, errorOf } from '@/lib/api';
import type { Me } from '@/lib/types';

/** Who is looking at /admin and which course they see (the API decides: see backend/src/admin). */
export interface AdminContext {
  user: Me;
  admin: boolean; // runs the whole app: sees email addresses, makes teachers and courses
  course: Course; // the course shown
  courses: Course[]; // the ones this person may pick
}

/**
 * One /admin page's data from the API. Not signed in → the login page; a student →
 * `{ student }` (the page says it is for teachers); the API unreachable → `{ down }`.
 */
export async function adminData<T>(
  path: string,
  endpoint: string,
  wanted: string | string[] | undefined,
  extra: Record<string, string> = {},
): Promise<(AdminContext & { data: T }) | { down: string } | { student: string }> {
  const query = new URLSearchParams(extra);
  if (typeof wanted === 'string') query.set('course', wanted);
  let r;
  try {
    r = await api<AdminContext & { data: T }>(`/admin/${endpoint}?${query}`);
  } catch (e) {
    console.error(`Karteikasten: the API is unreachable (${(e as Error).message}).`);
    return { down: 'The web app could not reach its API server.' };
  }
  if (r.status === 401) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (r.status === 403) return { student: String((r.data as unknown as { name?: unknown }).name ?? '') };
  if (r.status === 503) return { down: errorOf(r) };
  if (!r.ok) return { down: errorOf(r) };
  return r.data;
}

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
          <p><Link className="btn" href="/app">Back to the app</Link></p>
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
          <p className="hint">
            After fixing it, reload this page or open{' '}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- an API route (JSON), not a page */}
            <a href="/api/health">/api/health</a> to check.
          </p>
        </div>
      </div>
    </div>
  );
}
