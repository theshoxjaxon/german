import { afterEach, describe, expect, it } from 'vitest';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { courseJsonLd, HOME_FAQ, homeJsonLd, jsonLdHtml } from './seo';
import { COURSE_SEO, courseTitle, HOME_DESCRIPTION, HOME_TITLE, siteUrl, verification } from './site';

const ENV = ['APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'GOOGLE_SITE_VERIFICATION', 'YANDEX_VERIFICATION', 'BING_SITE_VERIFICATION'];
const set = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
};
afterEach(() => set(Object.fromEntries(ENV.map((k) => [k, undefined]))));

describe('the site address', () => {
  it('is APP_URL, else the Vercel production domain', () => {
    expect(siteUrl()).toBeUndefined();
    set({ VERCEL_PROJECT_PRODUCTION_URL: 'german-roan.vercel.app' });
    expect(siteUrl()).toBe('https://german-roan.vercel.app');
    set({ APP_URL: 'https://karteikasten.uz/' });
    expect(siteUrl()).toBe('https://karteikasten.uz'); // your own domain wins; no trailing slash
  });
});

describe('robots.txt and the sitemap', () => {
  it('keeps crawlers out of private pages and the API, except what public pages read', () => {
    set({ APP_URL: 'https://karteikasten.uz' });
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toEqual(expect.arrayContaining(['/', '/api/courses', '/api/state']));
    expect(rule.disallow).toEqual(expect.arrayContaining(['/api/', '/admin', '/account', '/app', '/reset-password']));
    expect(rule.disallow).not.toContain('/s/'); // share pages say noindex themselves
    expect(r.sitemap).toBe('https://karteikasten.uz/sitemap.xml');
  });

  it('lists the home page and both courses with absolute addresses', () => {
    set({ APP_URL: 'https://karteikasten.uz' });
    const urls = sitemap().map((e) => e.url);
    expect(urls).toEqual(expect.arrayContaining(['https://karteikasten.uz/', 'https://karteikasten.uz/german', 'https://karteikasten.uz/english']));
    expect(sitemap()[0]).toMatchObject({ url: 'https://karteikasten.uz/', priority: 1 });
  });
});

describe('titles, descriptions and verification', () => {
  it('says what the site is, in Uzbek, with the words people search for', () => {
    expect(HOME_TITLE).toMatch(/Nemis tili/);
    expect(HOME_DESCRIPTION).toMatch(/oʻzbekcha tarjima/);
    expect(COURSE_SEO.german.description).toMatch(/Немецкий язык/);
    expect(COURSE_SEO.german.description).toMatch(/German A1/);
    expect(courseTitle('german', 'German')).toBe(`${COURSE_SEO.german.title} | Karteikasten`);
    expect(courseTitle('french', 'French')).toBe('French · Karteikasten'); // a course an admin added
  });

  it('adds only the verification tags that are set', () => {
    expect(verification()).toBeUndefined();
    set({ GOOGLE_SITE_VERIFICATION: 'g-code' });
    expect(verification()).toEqual({ google: 'g-code' });
    set({ YANDEX_VERIFICATION: 'y-code', BING_SITE_VERIFICATION: 'b-code' });
    expect(verification()).toEqual({ google: 'g-code', yandex: 'y-code', other: { 'msvalidate.01': 'b-code' } });
  });
});

describe('structured data', () => {
  it('describes the site, the app and the FAQ on the home page', () => {
    const ld = homeJsonLd('https://karteikasten.uz') as { '@graph': { '@type': string; mainEntity?: unknown[] }[] };
    expect(ld['@graph'].map((x) => x['@type'])).toEqual(['WebSite', 'WebApplication', 'FAQPage']);
    expect(ld['@graph'][2].mainEntity).toHaveLength(HOME_FAQ.length);
  });

  it('describes each built-in course, and nothing for others', () => {
    expect(courseJsonLd('https://karteikasten.uz', 'german')).toMatchObject({ '@type': 'Course', url: 'https://karteikasten.uz/german', inLanguage: 'de', isAccessibleForFree: true });
    expect(courseJsonLd('https://karteikasten.uz', 'french')).toBeNull();
  });

  it('can never close its <script> tag', () => {
    const html = jsonLdHtml({ text: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('<');
    expect(JSON.parse(html)).toEqual({ text: '</script><script>alert(1)</script>' });
  });
});
