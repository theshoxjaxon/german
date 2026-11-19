/**
 * The interface in English or Uzbek (Oʻzbekcha).
 *
 * Texts are written in English in the code and looked up by that same English text in the Uzbek
 * dictionary (i18n-uz.ts); anything without an entry simply stays English. Messages that come
 * from the server (errors) go through the same lookup, so they are translated too. {name}
 * placeholders are filled in after the lookup. A test checks that every text the code
 * translates has an Uzbek entry.
 */
import { UZ } from './i18n-uz';
import type { UiLang } from './types';
import { DAY, MIN } from './time';

export type Vars = Record<string, string | number>;

export function translate(lang: UiLang, en: string, vars?: Vars): string {
  const text = lang === 'uz' ? (UZ[en] ?? en) : en;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** A count: English picks "{n} word" or "{n} words"; Uzbek has one form after a number ("3 ta soʻz"). */
export function translateCount(lang: UiLang, n: number, one: string, many: string, vars?: Vars): string {
  return translate(lang, n === 1 ? one : many, { n, ...vars });
}

const trim1 = (n: number, lang: UiLang) => {
  const s = n.toFixed(1).replace(/\.0$/, '');
  return lang === 'uz' ? s.replace('.', ',') : s;
};

/** A time span, short: "10m", "4d" in English; "10 daq", "4 kun" in Uzbek. */
export function span(lang: UiLang, ms: number): string {
  const u = lang === 'uz' ? { lt: '<1 daq', m: ' daq', h: ' soat', d: ' kun', mo: ' oy', y: ' yil' } : { lt: '<1m', m: 'm', h: 'h', d: 'd', mo: 'mo', y: 'y' };
  const m = ms / MIN;
  if (m < 1) return u.lt;
  if (m < 60) return Math.round(m) + u.m;
  if (m < 1440) return Math.round(m / 60) + u.h;
  const d = ms / DAY;
  if (d < 30) return Math.round(d) + u.d;
  if (d < 365) return trim1(d / 30, lang) + u.mo;
  return trim1(d / 365, lang) + u.y;
}
