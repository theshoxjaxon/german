import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import * as repo from '@/lib/server/repo';
import { adminData, DatabaseDown } from './guard';

export const metadata: Metadata = { title: 'Admin · Karteikasten' };

export default function AdminPage() {
  return (
    // The session is read at request time, so it sits behind a Suspense boundary (required with Cache Components).
    <Suspense fallback={<div className="admin-main"><div className="panel loading" aria-busy="true">Loading the dashboard…</div></div>}>
      <AdminData />
    </Suspense>
  );
}

async function AdminData() {
  await connection(); // everything below depends on the request and the current time
  const r = await adminData('/admin', () => repo.adminStats());
  if ('down' in r) return <DatabaseDown message={r.down} />;
  return <AdminDashboard stats={r.data} meId={r.user.id} />;
}
