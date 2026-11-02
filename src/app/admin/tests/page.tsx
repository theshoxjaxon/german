import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AdminTests } from '@/components/admin/AdminTests';
import * as repo from '@/lib/server/repo';
import { testInfo, testsFor } from '@/lib/server/tests';
import { adminData, DatabaseDown, NotAdmin } from '../guard';

export const metadata: Metadata = { title: 'Mock tests · Karteikasten' };

export default function TestsPage({ searchParams }: PageProps<'/admin/tests'>) {
  return (
    <Suspense fallback={<div className="admin-main"><div className="panel loading" aria-busy="true">Loading the results…</div></div>}>
      <TestsData searchParams={searchParams} />
    </Suspense>
  );
}

/** The course's mock-test results: every student's best score per test, and the latest attempts. */
async function TestsData({ searchParams }: Pick<PageProps<'/admin/tests'>, 'searchParams'>) {
  await connection(); // per request: results change with every attempt
  const params = await searchParams;
  const r = await adminData('/admin/tests', params.course, async (c) => ({
    tests: testsFor(c.course.id).map(testInfo),
    ...(await repo.courseTestResults(c.course.id)),
  }));
  if ('down' in r) return <DatabaseDown message={r.down} />;
  if ('student' in r) return <NotAdmin name={r.student} />;
  return <AdminTests course={r.course} courses={r.courses} admin={r.admin} {...r.data} />;
}
