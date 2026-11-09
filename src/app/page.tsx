import type { Metadata } from 'next';
import { HomeAbout } from '@/components/HomeAbout';
import { Welcome } from '@/components/Welcome';
import { homeJsonLd, jsonLdHtml } from '@/lib/seo';
import { siteUrl } from '@/lib/site';

// The home page's own address (set here, not in the layout, so other pages don't inherit it)
export const metadata: Metadata = { alternates: { canonical: '/' }, openGraph: { url: '/' } };

/**
 * The front door: pick German or English (or continue the course you study). Each course lives at
 * /<id>. Under it, what the app is (for people and search engines), and its structured data.
 */
export default function Page() {
  const base = siteUrl() ?? 'http://localhost:3000';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(homeJsonLd(base)) }} />
      <Welcome />
      <HomeAbout />
    </>
  );
}
