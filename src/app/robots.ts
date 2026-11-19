import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site';

/**
 * /robots.txt: crawl the public pages; stay out of private ones and the API. Two API routes stay
 * open because the public pages read them while Google renders them (the course cards on /, the
 * guest app on /german). /c/ stays open so old links can be followed to /<course>. Share pages
 * (/s/…) stay crawlable: they say noindex themselves, and a blocked page couldn't say it.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/courses', '/api/state'],
      disallow: ['/api/', '/admin', '/account', '/app', '/forgot-password', '/reset-password'],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  };
}
