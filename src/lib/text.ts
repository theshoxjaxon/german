import type { Pos } from './types';

/** o‘ oʻ o’ o' all count as the same letter when searching Uzbek text. */
const APOS_RE = /[ʻʼ‘’`´']/g;

/** Lower-case, strip accents and umlauts, unify apostrophes: for search and duplicate checks. */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(APOS_RE, "'")
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim();
}

export type Article = 'der' | 'die' | 'das';
export const ARTICLES: Article[] = ['der', 'die', 'das'];
const ART_RE = /^(der|die|das)\s+(.+)$/i;

/** "die Familie" → { art: 'die', rest: 'Familie' } */
export function splitTerm(term: string): { art: Article | ''; rest: string } {
  const t = String(term ?? '').trim();
  const m = ART_RE.exec(t);
  return m ? { art: m[1].toLowerCase() as Article, rest: m[2] } : { art: '', rest: t };
}

export const genderOf = (term: string) => splitTerm(term).art;

/** Collapse spaces and lower-case a leading article: "Die  Familie" → "die Familie". */
export function cleanTerm(t: string): string {
  const s = String(t ?? '').trim().replace(/\s+/g, ' ');
  const m = ART_RE.exec(s);
  return m ? `${m[1].toLowerCase()} ${m[2]}` : s;
}

export function guessPos(term: string): Pos {
  const t = String(term).trim();
  if (ART_RE.test(t)) return 'noun';
  if (/[?!]$/.test(t) || /\s/.test(t)) return 'phrase';
  if (/^[a-zäöüß]+(en|ern|eln)$/.test(t)) return 'verb';
  if (/^[A-ZÄÖÜ]/.test(t)) return 'noun';
  return 'other';
}

/** Long German compounds get a smaller font on the card. */
export function termSizeClass(term: string): string {
  const { rest } = splitTerm(term);
  const longest = Math.max(...rest.split(/\s+/).map((w) => w.length));
  return longest > 15 || rest.length > 26 ? 'is-xlong' : longest > 11 || rest.length > 16 ? 'is-long' : '';
}

/**
 * Split an example sentence into parts and flag the ones that are forms of the studied word,
 * e.g. sprechen → "spreche", Familie → "Familie". Returns plain text parts; the UI decides how to mark them.
 */
export function highlightParts(example: string, term: string): { text: string; mark: boolean }[] {
  const stems = splitTerm(term)
    .rest.split(/[\s,.?!…]+/)
    .filter((w) => w.length >= 3)
    .map((w) => {
      const n = norm(w);
      return n.length <= 5 ? n : n.slice(0, n.length - 2);
    });
  const parts = String(example).split(/([\p{L}\p{M}][\p{L}\p{M}-]*)/u);
  return parts
    .map((text, i) => ({ text, mark: i % 2 === 1 && stems.some((s) => norm(text).startsWith(s)) }))
    .filter((p) => p.text);
}

export const parseTags = (s: string): string[] => [
  ...new Set(
    String(s ?? '')
      .split(/[,#]/)
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean),
  ),
];

/** Ids are minted on the client, so creating a word is an idempotent PUT. */
export const newId = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,120}$/;
/** The random id a browser makes up for anonymous visit counting (a UUID). */
export const VISITOR_RE = /^[A-Za-z0-9-]{16,64}$/;
