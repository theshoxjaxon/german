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

/**
 * Everything the app does or says differently per language studied. `text` is in English and
 * shown through t() like every other text; hello, correct, done, pause and box are in the
 * language studied, on purpose.
 */
export interface LangInfo {
  code: TargetLang; // the lang attribute on words and sentences (screen readers, fonts, spelling)
  name: string; // 'German'
  locale: string; // dates on the study and progress pages are in the language studied
  voices: [string, string][]; // read-aloud voices; the first is the default
  sample: string; // played when you try the speech speed
  articles: boolean; // der/die/das: the article quiz, gender colours, sorting by the noun
  hello: string;
  correct: string; // after picking the right article
  done: string; // the end of a session
  pause: string; // a break in a session
  box: string; // a Leitner box on the progress page: "Fach 1"
  text: {
    word: string; // the word form's label
    enterWord: string;
    typeFirst: string;
    notRecognised: string;
    prompt: string; // on a production card
    dirF: string;
    dirR: string;
    recognitionHint: string;
    productionHint: string;
    autoplayHint: string;
    forms: string; // the forms field's placeholder
    aiNone: string;
    aiPhoto: string;
    aiTextLabel: string;
    aiTextHint: string;
    guestLede: string;
  };
}

export const LANGS: Record<TargetLang, LangInfo> = {
  de: {
    code: 'de', name: 'German', locale: 'de-DE',
    voices: [['de-DE', 'German (Germany)'], ['de-AT', 'German (Austria)'], ['de-CH', 'German (Switzerland)']],
    sample: 'die Familie', articles: true,
    hello: 'Hallo', correct: 'Richtig!', done: 'Fertig!', pause: 'Pause', box: 'Fach',
    text: {
      word: 'German word or phrase',
      enterWord: 'Enter the German word or phrase.',
      typeFirst: 'Type the German word first.',
      notRecognised: 'The AI didn’t recognise this as a German word.',
      prompt: 'In German?',
      dirF: 'German → meaning',
      dirR: 'meaning → German',
      recognitionHint: 'See the German word, recall the meaning',
      productionHint: 'See the meaning, say the German word with its article. Each word gets a second card.',
      autoplayHint: 'Automatically, when you see the German word',
      forms: 'Plural, or verb forms: er spricht · sprach · hat gesprochen',
      aiNone: 'No German words found.',
      aiPhoto: 'Take a photo of a word list: a textbook page, a worksheet, the whiteboard or your notes. The AI finds the German words and fills in the rest.',
      aiTextLabel: 'German words, one per line',
      aiTextHint: 'Just the German is enough. The AI adds the article, meaning, pronunciation, forms, an example and a memory hook. Meanings you type are kept.',
      guestLede: 'German A1 words with Uzbek meanings. A few minutes a day: each card comes back just before you’d forget it.',
    },
  },
  en: {
    code: 'en', name: 'English', locale: 'en-GB',
    voices: [['en-GB', 'English (UK)'], ['en-US', 'English (US)']],
    sample: 'family', articles: false,
    hello: 'Hello', correct: 'Correct!', done: 'Done!', pause: 'Break', box: 'Box',
    text: {
      word: 'English word or phrase',
      enterWord: 'Enter the English word or phrase.',
      typeFirst: 'Type the English word first.',
      notRecognised: 'The AI didn’t recognise this as an English word.',
      prompt: 'In English?',
      dirF: 'English → meaning',
      dirR: 'meaning → English',
      recognitionHint: 'See the English word, recall the meaning',
      productionHint: 'See the meaning, say the English word. Each word gets a second card.',
      autoplayHint: 'Automatically, when you see the English word',
      forms: 'Irregular forms: go · went · gone, or child · children',
      aiNone: 'No English words found.',
      aiPhoto: 'Take a photo of a word list: a textbook page, a worksheet, the whiteboard or your notes. The AI finds the English words and fills in the rest.',
      aiTextLabel: 'English words, one per line',
      aiTextHint: 'Just the English is enough. The AI adds the meaning, pronunciation, forms, an example and a memory hook. Meanings you type are kept.',
      guestLede: 'English words from A1 to B2 with Uzbek meanings. A few minutes a day: each card comes back just before you’d forget it.',
    },
  },
};

/** The language of a course (German when there is none yet). */
export const langOf = (course: Pick<Course, 'targetLang'> | null | undefined): LangInfo => LANGS[course?.targetLang ?? 'de'];

/** The read-aloud voice: the one you picked in Settings if it speaks this language, else its default. */
export const voiceFor = (ttsLang: string, lang: LangInfo): string =>
  lang.voices.some(([v]) => v === ttsLang) ? ttsLang : lang.voices[0][0];

/** Everyone from before courses existed studies German. */
export const DEFAULT_COURSE = 'german';

/** Course ids are short and safe in a link: "english", "german-b1". */
export const COURSE_ID_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;
export const isCourseId = (v: unknown): v is string => typeof v === 'string' && COURSE_ID_RE.test(v);

/** The cookie that remembers a guest's course (and the course a link like /c/english picked). */
export const COURSE_COOKIE = 'kk_course';
