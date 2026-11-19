/**
 * Structured data (schema.org JSON-LD) for search engines: what the site is (a free educational
 * web app), the home page's FAQ, and each built-in course. Rendered as
 * <script type="application/ld+json"> by the pages; see jsonLdHtml() for the escaping.
 */
import { COURSE_SEO, HOME_DESCRIPTION, SITE_NAME } from './site';

/** The home page's questions and answers, shown on the page and given to search engines alike. */
export const HOME_FAQ: { q: string; a: string }[] = [
  { q: 'Karteikasten bepulmi?', a: 'Ha, butunlay bepul. Roʻyxatdan oʻtmasdan ham kartochkalarni sinab koʻrishingiz mumkin.' },
  { q: 'Qaysi darslik asosida?', a: 'Nemis tili kursi Momente A1 (Lektion 1–12) asosida, ingliz tili kursi esa A1 dan B2 gacha.' },
  { q: 'Telefonda ishlaydimi?', a: 'Ha. Brauzerda ochiladi, uni bosh ekranga ilova sifatida qoʻshish ham mumkin (Android va iPhone).' },
  {
    q: 'Goethe-Zertifikat A1 imtihoniga tayyorlaydimi?',
    a: 'Ha, yordam beradi: sinov testlari toʻrt qism boʻyicha tuzilgan (Grammatik, Lesen, Schreiben, Sprechen), har bir qismdan oʻtish uchun 18/25 ball kerak.',
  },
];

type Json = Record<string, unknown>;

/** The home page: the site, the app, and the FAQ. */
export function homeJsonLd(base: string): Json {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${base}/#website`, name: SITE_NAME, url: `${base}/`, inLanguage: 'uz', description: HOME_DESCRIPTION },
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: `${base}/`,
        description: HOME_DESCRIPTION,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any (web browser: Android, iPhone, computer)',
        inLanguage: ['uz', 'ru', 'en'],
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'UZS' },
      },
      {
        '@type': 'FAQPage',
        inLanguage: 'uz',
        mainEntity: HOME_FAQ.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ],
  };
}

/** A built-in course's page. Null for courses without search text (ones an admin added). */
export function courseJsonLd(base: string, id: string): Json | null {
  const c = COURSE_SEO[id];
  if (!c) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: c.description,
    url: `${base}/${id}`,
    inLanguage: c.inLanguage,
    availableLanguage: ['uz'],
    educationalLevel: c.level,
    isAccessibleForFree: true,
    provider: { '@type': 'Organization', name: SITE_NAME, url: `${base}/` },
  };
}

/** JSON for inside a <script> tag: every "<" escaped, so no text in it can close the tag. */
const LT = `${String.fromCharCode(92)}u003c`;
export const jsonLdHtml = (data: Json) => JSON.stringify(data).replace(/</g, LT);
