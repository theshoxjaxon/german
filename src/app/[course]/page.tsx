import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import KarteikastenApp from '@/components/KarteikastenApp';
import { isCourseId } from '@/lib/courses';
import { courseJsonLd, jsonLdHtml } from '@/lib/seo';
import { COURSE_SEO, SITE_NAME, siteUrl } from '@/lib/site';

/** The built-in courses are prerendered; courses an admin adds later render on their first visit. */
export function generateStaticParams() {
  return [{ course: 'german' }, { course: 'english' }];
}

/** What search engines and link previews show for /german and /english. */
export async function generateMetadata({ params }: PageProps<'/[course]'>): Promise<Metadata> {
  const { course } = await params;
  const seo = COURSE_SEO[course];
  if (!seo) return { title: SITE_NAME };
  const title = `${seo.title} | ${SITE_NAME}`;
  return {
    title,
    description: seo.description,
    alternates: { canonical: `/${course}` },
    openGraph: { title, description: seo.description, url: `/${course}`, siteName: SITE_NAME, locale: 'uz_UZ', type: 'website' },
  };
}

/**
 * A course's own page: /german, /english (and /<id> for any other course). The app opens in
 * that course; switching course in the app changes the address.
 */
export default async function CoursePage({ params }: PageProps<'/[course]'>) {
  const { course } = await params;
  if (!isCourseId(course)) notFound();
  const ld = courseJsonLd(siteUrl() ?? 'http://localhost:3000', course);
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(ld) }} />}
      <KarteikastenApp urlCourse={course} />
    </>
  );
}
