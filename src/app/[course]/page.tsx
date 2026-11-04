import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KarteikastenApp from '@/components/KarteikastenApp';
import { isCourseId } from '@/lib/courses';

/** The built-in courses are prerendered; courses an admin adds later render on their first visit. */
export function generateStaticParams() {
  return [{ course: 'german' }, { course: 'english' }];
}

const TITLES: Record<string, string> = { german: 'Nemis tili · Karteikasten', english: 'Ingliz tili · Karteikasten' };

export async function generateMetadata({ params }: PageProps<'/[course]'>): Promise<Metadata> {
  const { course } = await params;
  return { title: TITLES[course] ?? 'Karteikasten' };
}

/**
 * A course's own page: /german, /english (and /<id> for any other course). The app opens in
 * that course; switching course in the app changes the address.
 */
export default async function CoursePage({ params }: PageProps<'/[course]'>) {
  const { course } = await params;
  if (!isCourseId(course)) notFound();
  return <KarteikastenApp urlCourse={course} />;
}
