/**
 * Mock tests, in the format of the class's own tests, by level (A1.1 first):
 *   unit   a Wiederholungstest per Modul: Teil A Grammatik (25 a–d) + Teil B Lesen (5 richtig/falsch), /30
 *   final  the Abschlusstest: Grammatik, Lesen, Schreiben, Sprechen, 25 each; passed with 18 in every part
 * The content (with its answer key) lives on the server (german-a1.ts); the browser gets it
 * without answers (publicTest()). Shared by the server and the browser.
 */

export type SectionId = 'hoeren' | 'lesen' | 'grammatik' | 'schreiben' | 'sprechen';

/** What each part is called: `title` German (as in the test), `label` the interface name. */
export const SECTIONS: { id: SectionId; title: string; label: string }[] = [
  { id: 'grammatik', title: 'Grammatik', label: 'Grammar' },
  { id: 'lesen', title: 'Lesen', label: 'Reading' },
  { id: 'hoeren', title: 'Hören', label: 'Listening' },
  { id: 'schreiben', title: 'Schreiben', label: 'Writing' },
  { id: 'sprechen', title: 'Sprechen', label: 'Speaking' },
];
export const sectionMeta = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;

/** The levels, in order. Those without tests yet show as "opens soon". */
export const LEVELS = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2', 'C2.1', 'C2.2'] as const;
export type Level = (typeof LEVELS)[number];

export type TestKind = 'unit' | 'final';
/** A unit score this good is "on track" for the final (18 of 25 per part). */
export const ON_TRACK = 18 / 25;

/** A line of a listening script. a: a woman, b: a man, n: an announcer. */
export interface Line {
  who: 'a' | 'b' | 'n';
  text: string;
}

/** Something to read: an email, an ad, a sign. */
export interface ReadText {
  kind: 'email' | 'ad' | 'sign' | 'note' | 'web';
  title?: string;
  body: string;
}

interface ItemBase {
  id: string; // unique within the test: 'h1-3'
  audio?: Line[]; // a clip for this question only (listening)
  text?: ReadText; // a text for this question only (reading: a sign, a pair of ads)
}

/** Pick one option (a–d). `answer` is the index of the right one. `reply`: the dialogue's second line (• …). */
export interface ChoiceItem extends ItemBase {
  type: 'choice';
  prompt: string;
  reply?: string;
  options: string[];
  answer: number;
}

/** Richtig oder falsch. */
export interface TrueFalseItem extends ItemBase {
  type: 'truefalse';
  prompt: string;
  answer: boolean;
}

/** Type the missing word(s): `prompt` has ___ where the gap is. Any of `answer` is right. */
export interface GapItem extends ItemBase {
  type: 'gap';
  prompt: string;
  answer: string[];
  hint?: string; // e.g. the infinitive: (wohnen)
}

/** One field of a form to fill in from a text (Schreiben Teil 1). */
export interface FormItem extends ItemBase {
  type: 'form';
  label: string; // the field: "Alter"
  answer: string[];
}

/** A short message (Schreiben Teil 2), scored by the AI like a Goethe examiner: 3 per content point + 1. */
export interface WritingItem extends ItemBase {
  type: 'writing';
  prompt: string; // the situation, German
  promptUz: string;
  points: string[]; // what to write about, German
  words: number; // about how many words
  model: string; // a model answer, shown after submitting
}

/**
 * A speaking task, answered aloud (turned into text) or typed; scored by the AI.
 *   intro      sich vorstellen with keyword cards (1 point per card)
 *   partner    one question of the "partner" (read aloud: `audio`), answered (2 points)
 *   yesterday  what you did yesterday, in the Perfekt (2 per correct sentence, up to 3)
 *   cards      a question for each word card (2 per card)
 */
export type SpeakingKind = 'intro' | 'partner' | 'yesterday' | 'cards';
export interface SpeakingItem extends ItemBase {
  type: 'speaking';
  kind: SpeakingKind;
  prompt: string; // German
  promptUz: string;
  cards: string[]; // keywords or word cards
  max: number; // points for this task
  model: string;
}

export type Item = ChoiceItem | TrueFalseItem | GapItem | FormItem | WritingItem | SpeakingItem;
export type AutoItem = ChoiceItem | TrueFalseItem | GapItem | FormItem;
export type OpenItem = WritingItem | SpeakingItem;
export const isOpen = (item: Item): item is OpenItem => item.type === 'writing' || item.type === 'speaking';

/** Points an item is worth before its section is scaled to the section's points. */
export const itemMax = (item: Item) => (item.type === 'writing' ? 10 : item.type === 'speaking' ? item.max : 1);

/** One Teil: an instruction, maybe texts or a recording, and its questions. */
export interface Task {
  id: string;
  title: string; // "Teil 1"
  instruction: string; // German, as in the exam
  instructionUz: string;
  texts?: ReadText[]; // shared by all its questions (reading)
  audio?: Line[]; // shared by all its questions (listening)
  items: Item[];
}

export interface Section {
  id: SectionId;
  points: number; // what the part is worth: its items are scaled to this
  pass?: number; // the least you need in this part to pass (finals)
  tasks: Task[];
}

export interface Test {
  id: string; // also in the address: 'a11-modul-1'
  course: string; // the course it belongs to
  level: Level;
  kind: TestKind;
  title: string; // "Wiederholungstest Modul 1"
  subtitle: string; // "Lektion 1–3"
  minutes: number; // about how long it takes
  topics: string; // one line, English (shown through t())
  themes: string; // the topics as on the paper, German: "Hobbys, Freizeit, …"
  sections: Section[];
}

/* ---------- what the browser gets ---------- */

/** An item without its answer or model answer. */
export type PublicItem =
  | Omit<ChoiceItem, 'answer'>
  | Omit<TrueFalseItem, 'answer'>
  | Omit<GapItem, 'answer'>
  | Omit<FormItem, 'answer'>
  | Omit<WritingItem, 'model'>
  | Omit<SpeakingItem, 'model'>;
export type PublicTask = Omit<Task, 'items'> & { items: PublicItem[] };
export type PublicTest = Omit<Test, 'sections'> & { sections: (Omit<Section, 'tasks'> & { tasks: PublicTask[] })[] };

/** A test in the list: no questions. */
export type TestInfo = Omit<Test, 'sections'>;

/** What someone answered: item id → the option index, true/false or text. */
export type Answers = Record<string, number | boolean | string>;

/* ---------- results ---------- */

export interface ItemResult {
  ok: boolean;
  points: number;
  max: number;
  correct: string; // the right answer, to show
}

/** The AI's verdict on one writing or speaking task. */
export interface OpenFeedback {
  points: number;
  max: number;
  summary: string; // in the interface language
  corrections: { wrong: string; right: string; why: string }[];
  tip: string;
}

export interface SectionResult {
  id: SectionId;
  raw: number; // points before scaling
  rawMax: number;
  score: number; // out of `max`, in half points
  max: number; // the part's points
  pass?: number; // needed to pass (finals)
  pending: boolean; // writing or speaking not scored yet (AI feedback to come, or unavailable)
}

export interface TestResult {
  testId: string;
  items: Record<string, ItemResult>; // automatically scored items
  open: Record<string, OpenFeedback>; // writing and speaking, once the AI has scored them
  sections: SectionResult[];
  score: number; // so far, while something is pending
  max: number; // 30 for a Wiederholungstest, 100 for the final
  complete: boolean;
  passed: boolean | null; // finals, once complete: every part reached its pass mark; null for units
}

/** An attempt as listed: one row per try. */
export interface AttemptSummary {
  id: string;
  testId: string;
  score: number;
  max: number;
  complete: boolean;
  passed: boolean | null;
  sections: SectionResult[];
  submittedAt: number;
}

/** A finished attempt, with everything needed to review it. */
export interface AttemptDetail extends AttemptSummary {
  answers: Answers;
  result: TestResult;
  test: Test; // with answers and model answers: shown after submitting
  aiError?: string; // why the writing and speaking couldn't be scored
}

/** How a score pill looks: a final passed or not; a Wiederholungstest green once on track for the final. */
export const scoreTone = (a: { score: number; max: number; complete: boolean; passed: boolean | null }) =>
  !a.complete ? '' : a.passed === true ? ' is-pass' : a.passed === false ? ' is-fail' : a.score >= a.max * ON_TRACK ? ' is-pass' : '';
