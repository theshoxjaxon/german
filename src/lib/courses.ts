/**
 * Courses: German · Momente, English, … Each course has its own words (shared lesson words and
 * everyone's own words), its own members and leaderboard, its own teachers and the lesson its
 * class is on. One login works for every course; the active one is remembered per person.
 * Shared by the server and the browser.
 */

/** The languages the app can teach. Cards, voices and the AI helper follow this. */
export type TargetLang = 'de' | 'en';
export const TARGET_LANGS: TargetLang[] = ['de', 'en'];
export const isTargetLang = (v: unknown): v is TargetLang => TARGET_LANGS.includes(v as TargetLang);

export interface Course {
  id: string; // also its link: /c/<id>
  name: string; // "German · Momente"
  targetLang: TargetLang;
  note: string; // shown with the decks, e.g. "More words coming soon"; '' for none
  currentLesson: string | null; // the deck the class is on (set by a teacher)
  words: number; // shared lesson words
}

/** Everyone from before courses existed studies German. */
export const DEFAULT_COURSE = 'german';

/** Course ids are short and safe in a link: "english", "german-b1". */
export const COURSE_ID_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;
export const isCourseId = (v: unknown): v is string => typeof v === 'string' && COURSE_ID_RE.test(v);

/** The cookie that remembers a guest's course (and the course a link like /c/english picked). */
export const COURSE_COOKIE = 'kk_course';
