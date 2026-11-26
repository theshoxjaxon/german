import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AnalyticsView } from '@/components/admin/AnalyticsView';
import { parsePeriod, type Analytics } from '@/lib/analytics';
import { adminData, DatabaseDown, NotAdmin } from '../guard';

export const metadata: Metadata = { title: 'Analytics · Karteikasten' };

export default function AnalyticsPage({ searchParams }: PageProps<'/admin/analytics'>) {
  return (
    <Suspense fallback={<div className="admin-main"><div className="panel loading" aria-busy="true">Loading analytics…</div></div>}>
      <AnalyticsData searchParams={searchParams} />
    </Suspense>
  );
}

async function AnalyticsData({ searchParams }: Pick<PageProps<'/admin/analytics'>, 'searchParams'>) {
  await connection(); // depends on the request and the current time
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const r = await adminData<Analytics>('/admin/analytics', 'analytics', params.course, { period });
  if ('down' in r) return <DatabaseDown message={r.down} />;
  if ('student' in r) return <NotAdmin name={r.student} />;
  return <AnalyticsView data={r.data} admin={r.admin} course={r.course} courses={r.courses} />;
}
