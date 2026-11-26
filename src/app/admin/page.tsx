import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import type { TelegramAdminStatus } from '@/components/admin/AdminTelegram';
import type { AdminStats } from '@/lib/admin-types';
import { adminData, DatabaseDown, NotAdmin } from './guard';

export const metadata: Metadata = { title: 'Admin · Karteikasten' };

/** The Telegram panel: what's missing (names only), counts, and the quiz channel. */
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
  const r = await adminData<{ stats: AdminStats; telegram: TelegramAdminStatus | null }>('/admin', 'dashboard', (await searchParams).course);
  if ('down' in r) return <DatabaseDown message={r.down} />;
  if ('student' in r) return <NotAdmin name={r.student} />;
  // The Telegram bot is the whole site's, so only admins see it (counts only)
    // Keyed by course: notices and open sheets don't carry over to another course
  return <AdminDashboard key={r.course.id} stats={r.data.stats} meId={r.user.id} admin={r.admin} course={r.course} courses={r.courses} telegram={r.data.telegram} />;
}
