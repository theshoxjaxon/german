import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AdminStudy } from '@/components/admin/AdminStudy';
import { studyAdmin } from '@/lib/server/study';
import { adminData, DatabaseDown, NotAdmin } from '../guard';

export const metadata: Metadata = { title: 'Study together · Karteikasten' };

export default function StudyPage({ searchParams }: PageProps<'/admin/study'>) {
  return (
    <Suspense fallback={<div className="admin-main"><div className="panel loading" aria-busy="true">Loading…</div></div>}>
      <StudyData searchParams={searchParams} />
    </Suspense>
  );
}

/** Study together for teachers: when the class is free (counts only), speaking clubs, reports. Never a chat. */
async function StudyData({ searchParams }: Pick<PageProps<'/admin/study'>, 'searchParams'>) {
  await connection(); // per request: sign-ups change all week
  const params = await searchParams;
  const r = await adminData('/admin/study', params.course, (c) => studyAdmin(c.course.id));
  if ('down' in r) return <DatabaseDown message={r.down} />;
  if ('student' in r) return <NotAdmin name={r.student} />;
  return <AdminStudy course={r.course} courses={r.courses} admin={r.admin} view={r.data} />;
}
