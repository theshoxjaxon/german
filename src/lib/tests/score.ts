/**
 * Scoring a mock test. Pure functions, run on the server when someone submits (the browser
 * never has the answer key), and again when the AI has scored the writing and speaking.
 *
 *   automatic items (choice, richtig/falsch, gaps, form fields): 1 point each
 *   writing: 10 points (3 per content point + 1 for greeting and closing), from the AI
 *   speaking: the task's points, from the AI
 * Each part is scaled to its own points (half points); the total is their sum. A final is
 * passed only when every part reaches its pass mark (18 of 25), whatever the total.
 */
import {
  isOpen, itemMax,
  type Answers, type AutoItem, type Item, type ItemResult, type OpenFeedback, type PublicItem, type PublicTest, type SectionResult,
  type Test, type TestResult,
} from './types';

/** For comparing typed answers: case, spaces, final punctuation, and ä = ae, ö = oe, ü = ue, ß = ss. */
export function normalize(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[.!?,;:]+$/g, '');
}

export const allItems = (test: Pick<Test, 'sections'>): Item[] => test.sections.flatMap((s) => s.tasks.flatMap((t) => t.items));

/** The right answer, as shown to the student. */
function correctText(item: AutoItem): string {
  switch (item.type) {
    case 'choice': return item.options[item.answer] ?? '';
    case 'truefalse': return item.answer ? 'richtig' : 'falsch';
    default: return item.answer[0] ?? '';
  }
}

export function scoreItem(item: AutoItem, given: Answers[string] | undefined): ItemResult {
  let ok: boolean;
  switch (item.type) {
    case 'choice':
      ok = given === item.answer;
      break;
    case 'truefalse':
      ok = given === item.answer;
      break;
    default:
      ok = typeof given === 'string' && given.trim() !== '' && item.answer.some((a) => normalize(a) === normalize(given));
  }
  return { ok, points: ok ? 1 : 0, max: 1, correct: correctText(item) };
}

const half = (x: number) => Math.round(x * 2) / 2;

/** Parts of a final that are below their pass mark. */
export const shortParts = (sections: SectionResult[]) => sections.filter((s) => s.pass !== undefined && !s.pending && s.score < s.pass);

/**
 * The result of an attempt: the automatic items now, the open ones from `open` (the AI's scores)
 * when there are any. A section with writing or speaking not yet scored is `pending`.
 */
export function scoreAttempt(test: Test, answers: Answers, open: Record<string, OpenFeedback> = {}): TestResult {
  const items: Record<string, ItemResult> = {};
  const sections: SectionResult[] = test.sections.map((section) => {
    let raw = 0;
    let rawMax = 0;
    let pending = false;
    for (const item of section.tasks.flatMap((t) => t.items)) {
      const max = itemMax(item);
      rawMax += max;
      if (isOpen(item)) {
        const f = open[item.id];
        if (f) raw += Math.min(max, Math.max(0, f.points));
        else pending = true;
      } else {
        const r = scoreItem(item, answers[item.id]);
        items[item.id] = r;
        raw += r.points;
      }
    }
    const score = rawMax ? half((raw / rawMax) * section.points) : 0;
    return { id: section.id, raw, rawMax, score, max: section.points, ...(section.pass !== undefined ? { pass: section.pass } : {}), pending };
  });
  const score = half(sections.reduce((n, s) => n + s.score, 0));
  const max = sections.reduce((n, s) => n + s.max, 0);
  const complete = sections.every((s) => !s.pending);
  const passed = test.kind === 'final' && complete ? shortParts(sections).length === 0 : null;
  return { testId: test.id, items, open, sections, score, max, complete, passed };
}

/** Writing and speaking left empty: 0 points straight away, nothing for the AI to check. */
export function emptyOpen(test: Test, answers: Answers): Record<string, OpenFeedback> {
  const out: Record<string, OpenFeedback> = {};
  for (const item of allItems(test)) {
    const v = answers[item.id];
    if (isOpen(item) && !(typeof v === 'string' && v.trim())) out[item.id] = { points: 0, max: itemMax(item), summary: '', corrections: [], tip: '' };
  }
  return out;
}

/** A copy of `obj` without `key`. */
export const omit = <T extends object, K extends keyof T>(obj: T, key: K) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key)) as Omit<T, K>;

/** The test without its answer key and model answers, for taking it. */
export function publicTest(test: Test): PublicTest {
  return {
    ...test,
    sections: test.sections.map((s) => ({
      id: s.id,
      points: s.points,
      ...(s.pass !== undefined ? { pass: s.pass } : {}),
      tasks: s.tasks.map((t) => ({
        ...t,
        items: t.items.map((item) => (isOpen(item) ? omit(item, 'model') : omit(item, 'answer')) as PublicItem),
      })),
    })),
  };
}

/** Keep only answers to this test's items, of the right kind and size. */
export function cleanAnswers(test: Test, raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const given = raw as Record<string, unknown>;
  for (const item of allItems(test)) {
    const v = given[item.id];
    if (item.type === 'choice') {
      if (Number.isInteger(v) && (v as number) >= 0 && (v as number) < item.options.length) out[item.id] = v as number;
    } else if (item.type === 'truefalse') {
      if (typeof v === 'boolean') out[item.id] = v;
    } else if (typeof v === 'string' && v.trim()) {
      out[item.id] = v.trim().slice(0, isOpen(item) ? 2000 : 120);
    }
  }
  return out;
}
