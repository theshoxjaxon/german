import type { MetadataRoute } from 'next';
import { COURSE_SEO, siteUrl } from '../lib/site';

/**
 * /sitemap.xml: the pages worth finding. The built-in courses come from the code, so it needs no
 * database (it's built once per deploy). Submit it in Google Search Console, Yandex Webmaster and
 * Bing Webmaster Tools.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl() ?? 'http://localhost:3000';
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    ...Object.keys(COURSE_SEO).map((id) => ({ url: `${base}/${id}`, lastModified, changeFrequency: 'weekly' as const, priority: 0.9 })),
    { url: `${base}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/login`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
