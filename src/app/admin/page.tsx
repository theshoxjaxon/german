import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import * as repo from '@/lib/server/repo';
import { adminData, DatabaseDown, NotAdmin } from './guard';

export const metadata: Metadata = { title: 'Admin · Karteikasten' };

export default function AdminPage({ searchParams }: PageProps<'/admin'>) {
  return (
    // The session is read at request time, so it sits behind a Suspense boundary (required with Cache Components).
    <Suspense fallback={<div className="admin-main"><div className="panel loading" aria-busy="true">Loading the dashboard…</div></div>}>
      <AdminData searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminData({ searchParams }: Pick<PageProps<'/admin'>, 'searchParams'>) {
  await connection(); // everything below depends on the request and the current time
  const r = await adminData('/admin', (await searchParams).course, (c) => repo.adminStats(c.course.id, c.admin));
  if ('down' in r) return <DatabaseDown message={r.down} />;
  if ('student' in r) return <NotAdmin name={r.student} />;
  // Keyed by course: notices and open sheets don't carry over to another course
  return <AdminDashboard key={r.course.id} stats={r.data} meId={r.user.id} admin={r.admin} course={r.course} courses={r.courses} />;
}
