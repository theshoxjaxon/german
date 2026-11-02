/**
 * Mock tests in the style of the Goethe-Zertifikat A1 (Start Deutsch 1): listening, reading,
 * vocabulary & grammar, writing and speaking, 20 points each. The content (with its answer key)
 * lives on the server (german-a1.ts); the browser gets it without answers (publicTest()).
 * Shared by the server and the browser.
 */

export type SectionId = 'hoeren' | 'lesen' | 'grammatik' | 'schreiben' | 'sprechen';

/** The five parts of every test, in order. `title` is German (as in the exam), `label` the interface name. */
export const SECTIONS: { id: SectionId; title: string; label: string }[] = [
  { id: 'hoeren', title: 'Hören', label: 'Listening' },
  { id: 'lesen', title: 'Lesen', label: 'Reading' },
  { id: 'grammatik', title: 'Wortschatz & Grammatik', label: 'Vocabulary & grammar' },
  { id: 'schreiben', title: 'Schreiben', label: 'Writing' },
  { id: 'sprechen', title: 'Sprechen', label: 'Speaking' },
];
export const SECTION_POINTS = 20;
export const PASS_SCORE = 60;

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

/** Pick one option. `answer` is the index of the right one. */
export interface ChoiceItem extends ItemBase {
  type: 'choice';
  prompt: string;
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

/** A speaking task, answered aloud (turned into text) or typed; scored by the AI. */
export interface SpeakingItem extends ItemBase {
  type: 'speaking';
  part: 1 | 2 | 3;
  prompt: string; // German
  promptUz: string;
  cards: string[]; // keywords, word cards or picture cards ("🍎 Apfel")
  max: number; // points for this task
  model: string;
}

export type Item = ChoiceItem | TrueFalseItem | GapItem | FormItem | WritingItem | SpeakingItem;
export type AutoItem = ChoiceItem | TrueFalseItem | GapItem | FormItem;
export type OpenItem = WritingItem | SpeakingItem;
export const isOpen = (item: Item): item is OpenItem => item.type === 'writing' || item.type === 'speaking';

/** Points an item is worth before scaling its section to 20. */
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
  tasks: Task[];
}

export interface Test {
  id: string; // also in the address: 'a1-test-1'
  course: string; // the course it belongs to
  title: string; // "Test 1"
  subtitle: string; // "Lektion 1–3"
  minutes: number; // about how long it takes
  topics: string; // one line, English (shown through t())
  final?: boolean;
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
export type PublicTest = Omit<Test, 'sections'> & { sections: { id: SectionId; tasks: PublicTask[] }[] };

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
  score: number; // out of SECTION_POINTS, in half points
  pending: boolean; // writing or speaking not scored yet (AI feedback to come, or unavailable)
}

export interface TestResult {
  testId: string;
  items: Record<string, ItemResult>; // automatically scored items
  open: Record<string, OpenFeedback>; // writing and speaking, once the AI has scored them
  sections: SectionResult[];
  score: number; // out of 100 (so far, while something is pending)
  complete: boolean;
  grade: Grade | null; // only when complete
}

export type Grade = 'sehr gut' | 'gut' | 'befriedigend' | 'ausreichend' | 'nicht bestanden';

/** An attempt as listed: one row per try. */
export interface AttemptSummary {
  id: string;
  testId: string;
  score: number;
  complete: boolean;
  grade: Grade | null;
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
