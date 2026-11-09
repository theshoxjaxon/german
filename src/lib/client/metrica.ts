/**
 * Yandex Metrica in the browser: who visits, from where (search, Telegram, links), on what
 * (device, browser, city), and which key actions they take (goals). Turned on by setting
 * NEXT_PUBLIC_YANDEX_METRICA_ID; without it every function here does nothing.
 *
 * Privacy, kept by this file:
 *  - nothing personal is sent: no names, emails or user ids, only the course, the interface
 *    language and which goal
 *  - page addresses lose their query strings (a password-reset link carries a secret code), except
 *    campaign tags (utm_*, from, ref)
 *  - the tag never loads on /admin, /account or the password pages
 *  - Webvisor (screen recordings) is off unless NEXT_PUBLIC_YANDEX_WEBVISOR=1; private areas (the
 *    study chat, test answers, login forms) are masked with Metrica's ym-hide-content and
 *    ym-disable-keys classes either way
 */

export const METRICA_ID = Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_ID) || 0;
const WEBVISOR = process.env.NEXT_PUBLIC_YANDEX_WEBVISOR === '1';

/** The goals to create in Metrica (Goals → JavaScript event), with these exact identifiers. */
export const GOALS = {
  signup: 'Created a profile (email or Google)',
  course_pick: 'Picked a course on the welcome page',
  study_start: 'Started a study session',
  test_start: 'Started a mock test',
  test_done: 'Handed in a mock test',
  speaking_topic: 'Drew a speaking topic',
  gemini_open: 'Opened Gemini with a speaking topic',
  share: 'Shared a result',
  telegram_connect: 'Connected Telegram reminders',
  study_together_signup: 'Signed up for "Let\'s study together"',
} as const;
export type Goal = keyof typeof GOALS;

/** Paths where the tag never loads: admin pages (students' emails), the account page, password pages. */
export const isExcluded = (path: string) => /^\/(admin|account|reset-password|forgot-password)(\/|$)/.test(path);

/** The address Metrica gets: no query string, except campaign tags. */
export function cleanUrl(href: string): string {
  const u = new URL(href);
  const keep = new URLSearchParams();
  u.searchParams.forEach((v, k) => {
    if (/^utm_[a-z]+$/.test(k) || k === 'from' || k === 'ref') keep.set(k, v);
  });
  const q = keep.toString();
  return `${u.origin}${u.pathname}${q ? `?${q}` : ''}`;
}

type Ym = ((id: number, method: string, ...args: unknown[]) => void) & { a?: unknown[]; l?: number };
type MetricaWindow = Window & { ym?: Ym };
const ym = (): Ym | null => (METRICA_ID && typeof window !== 'undefined' ? (window as MetricaWindow).ym ?? null : null);

/**
 * Load the tag once: Metrica's own loader (a queue that holds calls until tag.js arrives), then
 * init. Page views are sent by hit(), since the app changes pages without reloading.
 */
export function loadMetrica(): void {
  if (!METRICA_ID || typeof window === 'undefined') return;
  const w = window as MetricaWindow;
  if (w.ym) return;
  const stub = function (...args: unknown[]) {
    (stub.a = stub.a || []).push(args);
  } as Ym;
  stub.l = Date.now();
  w.ym = stub;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${METRICA_ID}`;
  document.head.appendChild(script);
  stub(METRICA_ID, 'init', { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: WEBVISOR });
}

/** A page view. A referrer on this site is cleaned like the page address (it's the previous page). */
export function hit(href: string, referer?: string): void {
  let from = referer;
  try {
    if (from && new URL(from).origin === new URL(href).origin) from = cleanUrl(from);
  } catch {
    from = undefined;
  }
  ym()?.(METRICA_ID, 'hit', cleanUrl(href), from ? { referer: from } : {});
}

/** A goal reached, with a few plain details (never anything personal). */
export function goal(name: Goal, params?: Record<string, string | number | boolean>): void {
  ym()?.(METRICA_ID, 'reachGoal', name, params);
}

/** What this visit is about (course, language, signed in), for Metrica's "Visit parameters" report. */
export function visitParams(params: Record<string, string | boolean>): void {
  ym()?.(METRICA_ID, 'params', params);
}
