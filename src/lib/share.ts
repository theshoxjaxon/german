/**
 * A shared result (/s/<id>): what the public page and its link preview show. A snapshot taken
 * when the student pressed Share, so later attempts or a renamed test don't change it.
 * Shared by the server and the browser.
 */
import type { TargetLang } from './courses';

interface Base {
  name: string; // first name only
  course: string; // its id: the page's "Try it too" opens /<course>
  targetLang: TargetLang;
}
export type ShareCard =
  | (Base & { kind: 'test'; title: string; subtitle: string; level: string; final: boolean; score: number; max: number; passed: boolean | null })
  | (Base & { kind: 'streak'; streak: number });

/** A share id as the server makes them: 96 random bits, base64url. */
export const isShareId = (v: string) => /^[A-Za-z0-9_-]{16}$/.test(v);

/** "Malika Karimova" → "Malika": the only part of a name a share shows. */
export const firstName = (displayName: string) => (displayName.trim().split(/\s+/)[0] || '').slice(0, 30);

/** The image font has no ʻ (U+02BB), so pictures use the look-alike ‘ (as Uzbek is often typed). */
export const imageSafe = (s: string) => s.replace(/ʻ/g, '‘').replace(/ʼ/g, '’');

/** One line for the link preview's title, in Uzbek (the class's language). */
export function shareTitle(c: ShareCard): string {
  if (c.kind === 'streak') return `${c.name}: ${c.streak} kunlik seriya`;
  return `${c.name}: ${c.title} · ${c.score}/${c.max}${c.passed ? ' · bestanden' : ''}`;
}
