import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { BrandMark } from '@/components/auth/AuthShell';
import { describeDbError } from '@/lib/server/db-health';
import * as repo from '@/lib/server/repo';
import { currentUser } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Admin · Karteikasten' };

export default function AdminPage() {
  return (
    <div className="admin">
      <header className="appbar">
        <Link className="appbar-brand" href="/">
          <BrandMark size={26} />
          Karteikasten
        </Link>
        <span className="role-pill role-admin">Admin</span>
      </header>
      {/* The session is read at request time, so it sits behind a Suspense boundary (required with Cache Components). */}
      <Suspense fallback={<div className="admin-main"><div className="panel loading" aria-busy="true">Loading the dashboard…</div></div>}>
        <AdminData />
      </Suspense>
    </div>
  );
}

async function AdminData() {
  await connection(); // everything below depends on the request and the current time
  let user: repo.UserRow | null;
  let stats: repo.AdminStats | null;
  try {
    user = await currentUser();
    stats = user?.role === 'admin' ? await repo.adminStats() : null;
  } catch (e) {
    // Show the teacher what is wrong instead of a bare error page; the message never contains the connection string.
    const { problem, message } = describeDbError(e);
    console.error(`Karteikasten: database unavailable (${problem}). ${message}`);
    return (
      <div className="admin-main">
        <div className="panel" role="alert">
          <h2>The database isn’t reachable</h2>
          <p className="err">{message}</p>
          <p className="hint">After fixing it, reload this page or open <a href="/api/health">/api/health</a> to check.</p>
        </div>
      </div>
    );
  }
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin' || !stats) redirect('/');
  return <AdminDashboard stats={stats} meId={user.id} />;
}
