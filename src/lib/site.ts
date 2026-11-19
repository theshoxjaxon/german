/**
 * What search engines and link previews read about the site: its public address, the titles and
 * descriptions of the home page and each course page, and the site-verification codes for Google,
 * Yandex and Bing. Titles and descriptions are Uzbek first (the class's language), with the Russian
 * and English words people also search for.
 */
import type { Metadata } from 'next';

export const SITE_NAME = 'Karteikasten';

/** The site's public address: APP_URL (your own domain), else Vercel's production domain; undefined locally. */
export function siteUrl(): string | undefined {
  const set = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (set) return set;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : undefined;
}

export const HOME_TITLE = `Nemis tili kartochkalari va A1 sinov testlari — oʻzbekcha | ${SITE_NAME}`;
export const HOME_DESCRIPTION =
  'Nemis va ingliz tili soʻzlarini oʻzbekcha tarjima bilan kartochkalarda oʻrganing: takrorlash tizimi, der/die/das mashqi, ' +
  'Goethe A1 / Momente A1 sinov testlari va gapirish mashqi. Bepul, telefonda ham ishlaydi.';

/** The built-in courses' pages, as search engines see them. */
export const COURSE_SEO: Record<string, { title: string; description: string; inLanguage: string; level: string }> = {
  german: {
    title: 'Nemis tilini oʻrganish: A1 soʻzlar, kartochkalar va Goethe A1 testlar',
    description:
      'Momente A1 (Lektion 1–12) ning 650 dan ortiq soʻzi oʻzbekcha tarjima bilan, der/die/das mashqi, Goethe A1 sinov testlari ' +
      'va 60 ta gapirish kartochkasi. Немецкий язык A1 с узбекским переводом. German A1 for Uzbek speakers. Bepul.',
    inLanguage: 'de',
    level: 'A1',
  },
  english: {
    title: 'Ingliz tili soʻzlari A1–B2: oʻzbekcha tarjimali kartochkalar',
    description:
      'Ingliz tilining A1, A2, B1 va B2 darajadagi 1300 dan ortiq soʻzi oʻzbekcha tarjima, misol gap va talaffuz bilan. ' +
      'Английские слова A1–B2 с узбекским переводом. English vocabulary for Uzbek speakers. Bepul.',
    inLanguage: 'en',
    level: 'A1–B2',
  },
};

/** A course page's tab title: the search title for the built-in courses, else "<name> · Karteikasten". */
export const courseTitle = (id: string, name: string) => (COURSE_SEO[id] ? `${COURSE_SEO[id].title} | ${SITE_NAME}` : `${name} · ${SITE_NAME}`);

/**
 * The "HTML tag" codes from Google Search Console, Yandex Webmaster and Bing Webmaster Tools, set
 * in the environment. Only the ones that are set become <meta> tags.
 */
export function verification(): Metadata['verification'] | undefined {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const yandex = process.env.YANDEX_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  if (!google && !yandex && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
  };
}
