import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { BrandMark } from '@/components/auth/AuthShell';
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
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin') redirect('/');
  const stats = await repo.adminStats();
  return <AdminDashboard stats={stats} meId={user.id} />;
}
