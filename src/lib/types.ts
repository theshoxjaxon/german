// Shared data model for the client, the API routes and the tests.
import type { Course } from './courses';

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy'];
export const RATING_LABEL: Record<Rating, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };

/** f = recognition (German → meaning), r = production (meaning → German) */
export type Dir = 'f' | 'r';
export type CardType = 'new' | 'learning' | 'review' | 'relearning';

export interface LogEntry {
  t: number; // answered at (ms)
  r: Rating;
  k: CardType; // card type before the answer
  i: number; // interval in days after the answer (0 while learning)
}

/** Scheduling state of one card (one word in one direction). */
export interface CardState {
  type: CardType;
  step: number; // index into the learning steps
  due: number; // ms timestamp
  ivl: number; // days, for review cards
  ease: number; // SM-2 E-Factor
  reps: number;
  lapses: number;
  first: number; // first answered (ms)
  last: number; // last answered (ms)
  log: LogEntry[]; // last 30 answers
}

/** Progress for one word: both directions plus a pause flag. Keyed by word id. */
export interface CardDoc {
  f: CardState | null;
  r: CardState | null;
  suspended: boolean;
  updatedAt: number;
}

export type Pos = 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'particle' | 'phrase' | 'other';
export const POS_OPTIONS: [Pos, string][] = [
  ['noun', 'Noun'], ['verb', 'Verb'], ['adjective', 'Adjective'], ['adverb', 'Adverb'],
  ['pronoun', 'Pronoun'], ['particle', 'Particle'], ['phrase', 'Phrase'], ['other', 'Other'],
];
export const POS_LABEL = Object.fromEntries(POS_OPTIONS) as Record<Pos, string>;

export interface WordData {
  term: string; // "die Familie" — nouns keep their article
  meaning: string;
  pos: Pos;
  pronunciation: string; // IPA
  forms: string; // plural or verb forms
  example: string;
  exampleTr: string;
  mnemonic: string; // memory hook
  notes: string;
  tags: string[];
  deck: string;
  order: number; // position in the source list
  createdAt: number;
  updatedAt: number;
}
export interface Word extends WordData {
  id: string;
  /** Your own word: only you see it and can change it. Absent on shared lesson words. Set by the server. */
  personal?: boolean;
}

/** How many own words one person may have. */
export const MAX_OWN_WORDS = 2000;

export interface Prefs {
  newPerDay: number;
  maxReviews: number;
  dirF: boolean;
  dirR: boolean;
  learnSteps: number[]; // minutes
  relearnSteps: number[]; // minutes
  autoplay: boolean;
  ttsLang: string;
  slowSpeech: boolean; // read words aloud more slowly
  genderQuiz: boolean; // nouns: pick der/die/das before the answer is shown
  dailyGoal: number; // answers a day; 0 = no goal
  uiLang?: UiLang; // unset until chosen: then the device's language is used
  studyDeck: string; // 'all' or a deck name
  bonusNew: { day: number; n: number } | null; // extra new cards for one study day
}

export type UiLang = 'en' | 'uz';
export const UI_LANGS: UiLang[] = ['en', 'uz'];

export const DEFAULT_PREFS: Prefs = {
  newPerDay: 20,
  maxReviews: 200,
  dirF: true,
  dirR: false,
  learnSteps: [1, 10],
  relearnSteps: [10],
  autoplay: false,
  ttsLang: 'de-DE',
  slowSpeech: false,
  genderQuiz: true,
  dailyGoal: 20,
  studyDeck: 'all',
  bonusNew: null,
};

/* ---------- accounts and the class (social) ---------- */

export type Role = 'student' | 'admin';

/** The signed-in person, as the client sees them (GET /api/me, /api/state). */
export interface Me {
  id: string;
  displayName: string;
  role: Role; // 'admin': runs the whole app (ADMIN_EMAILS)
  courseId: string; // the course being studied now
  teacher: boolean; // may change this course's lesson words and settings (its teachers, and admins)
  inClass: boolean; // on this course's leaderboard: everyone, unless a teacher took them off it
  avatarUrl: string | null; // the Google profile photo
  /** Only admins see an email address, their own included: students never see one, not even theirs. */
  email?: string;
  hasPassword: boolean;
  hasGoogle: boolean;
}

/**
 * On the class leaderboard: listed in the Class tab and can send cheers. Everyone who signs up
 * is (there's one class for now); a teacher can take someone off it. Admins always are.
 */
export const isClassMember = (me: Pick<Me, 'teacher' | 'inClass'> | null | undefined) => !!me && (me.teacher || me.inClass);

export type CheerKind = 'keep-going' | 'great-streak' | 'study-together';
export const CHEERS: Record<CheerKind, string> = {
  'keep-going': 'Keep going!',
  'great-streak': 'Great streak!',
  'study-together': 'Let’s study together',
};

export interface Cheer {
  id: string;
  kind: CheerKind;
  createdAt: number;
  from: { id: string; displayName: string };
}

/** One row on the Class tab. */
export interface ClassMember {
  id: string;
  displayName: string;
  role: Role; // 'admin': teaches this course (shown as "teacher")
  activeWords: number; // words started (learning or reviewing), not paused
  matureWords: number; // interval 21+ days
  streak: number; // days in a row with at least one answer
  studiedToday: boolean;
  answersToday: number;
  answersWeek: number; // last 7 days
  cheeredToday: boolean; // you already cheered them today
  isMe: boolean;
}

export interface ClassData {
  today: string; // 'YYYY-MM-DD' in the center's time zone
  members: ClassMember[];
}

/** What GET /api/state returns for the signed-in person. */
export interface AppData {
  me: Me;
  words: Record<string, Word>;
  cards: Record<string, CardDoc>;
  prefs: Prefs;
  cheers: Cheer[]; // cheers received and not yet seen
  ai: boolean; // the AI word helper is switched on for this server (for everyone signed in)
  streak: { days: number; studiedToday: boolean }; // from the server: right across all your devices
  classLesson: string | null; // the lesson the class is on, set by the teacher
  course: Course; // the course you're studying: words, cards and the class are this course's
  courses: Course[]; // every course, for the switcher
}

/** What GET /api/state returns to a guest (not signed in). Their progress stays in their browser. */
export interface GuestData {
  me: null;
  words: Record<string, Word>;
  classLesson: string | null;
  course: Course | null; // null: hasn't picked one yet (no words then)
  courses: Course[];
}

/** What the UI works with: Maps for fast lookup. */
export interface StudyData {
  words: Map<string, Word>;
  cards: Map<string, CardDoc>;
  prefs: Prefs;
  /** The lesson the class is on, set by the teacher (e.g. "Lektion 10"): see orderNewWords() in queue.ts. */
  classLesson?: string | null;
  /** The course studied: its language decides whether terms have der/die/das. */
  course?: Pick<Course, 'targetLang'> | null;
}
