/**
 * A Perfekt practice session and what a student's progress looks like.
 *
 * Progress is kept per rule (the last 10 answers for each) and per verb (the app's SM-2 schedule,
 * so a missed verb comes back tomorrow and a known one in days, then weeks). A session is 10
 * tasks of four kinds, mixed so the same kind never comes twice in a row; it leans toward the
 * student's weakest rules and brings due verbs first.
 */
import { answer as srsAnswer, SRS_DEFAULTS } from '../srs';
import type { CardState } from '../types';
import { checkAux, checkOrder, checkPartizip, checkTransform, type Checked } from './check';
import { RULES, ruleOf, sentence, SENTENCES, transform, TRANSFORMS, type Aux, type RuleId, type Verb } from './perfekt';

export type Task =
  | { type: 'partizip'; verb: string }
  | { type: 'aux'; verb: string }
  | { type: 'order'; id: string }
  | { type: 'transform'; id: string };

/** An answer as the trainer sends it: text for typed tasks, the helper verb, or the tile order. */
export type Given = string | number[];

export interface PerfektState {
  v: 1;
  /** Per verb id: its SM-2 schedule (answer log left out, to stay small). */
  verbs: Record<string, CardState>;
  /** Per rule: the last 10 answers, true = right. */
  rules: Record<RuleId, boolean[]>;
  sessions: number;
  /** Sentence and transform ids of the last two sessions, so they don't repeat at once. */
  recent: string[];
}

export const KEEP = 10;
/** A rule counts as learned at 80% right, with at least this many answers. */
export const LEARNED_AT = 0.8;
export const MIN_ANSWERS = 5;
export const SESSION_TASKS = 10;
/** Extra tasks a session may get: each missed verb comes back once, a few tasks later. */
export const MAX_RETRIES = 3;
export const MAX_ANSWERS = SESSION_TASKS + MAX_RETRIES;

export function emptyState(): PerfektState {
  return { v: 1, verbs: {}, rules: { regular: [], separable: [], noGe: [], irregular: [], aux: [] }, sessions: 0, recent: [] };
}

/** Accept a stored state only in the right shape; anything else starts fresh. */
export function sanitizeState(raw: unknown): PerfektState {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Partial<PerfektState>;
  if (o.verbs && typeof o.verbs === 'object') {
    for (const [id, c] of Object.entries(o.verbs)) {
      if (c && typeof c === 'object' && typeof c.due === 'number' && typeof c.ease === 'number') s.verbs[id] = { ...c, log: [] };
    }
  }
  for (const r of RULES) {
    const list = o.rules?.[r];
    if (Array.isArray(list)) s.rules[r] = list.filter((b) => typeof b === 'boolean').slice(-KEEP);
  }
  s.sessions = Number.isInteger(o.sessions) && o.sessions! > 0 ? o.sessions! : 0;
  s.recent = Array.isArray(o.recent) ? o.recent.filter((x): x is string => typeof x === 'string').slice(-8) : [];
  return s;
}

/** Share right of a rule's last answers, or null before the first one. */
export function ruleScore(state: PerfektState, rule: RuleId): number | null {
  const list = state.rules[rule];
  return list.length ? list.filter(Boolean).length / list.length : null;
}

export const ruleLearned = (state: PerfektState, rule: RuleId) => state.rules[rule].length >= MIN_ANSWERS && (ruleScore(state, rule) ?? 0) >= LEARNED_AT;

/** How much a rule needs practice: 1.3 for a weak one, 0.3 for a learned one, 0.8 when unknown. */
const need = (state: PerfektState, rule: RuleId) => 0.3 + (1 - (ruleScore(state, rule) ?? 0.5));

function weighted<T>(items: T[], weight: (x: T) => number, random: () => number): T | undefined {
  const total = items.reduce((n, x) => n + weight(x), 0);
  let r = random() * total;
  for (const x of items) {
    r -= weight(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

/** The order of task kinds in a session: never the same kind twice in a row. */
const PATTERN: Task['type'][] = ['partizip', 'aux', 'order', 'partizip', 'transform', 'partizip', 'aux', 'order', 'partizip', 'transform'];

/** Pick the 10 tasks of a session. */
export function pickSession(verbs: Verb[], state: PerfektState, now: number, random: () => number = Math.random): Task[] {
  const used = new Set<string>();
  const byInf = new Map(verbs.map((v) => [v.inf, v]));

  // Verbs due again come first (oldest first), then new verbs leaning toward the weak rules,
  // then the hardest known ones.
  const due = verbs.filter((v) => state.verbs[v.id] && state.verbs[v.id].due <= now).sort((a, b) => state.verbs[a.id].due - state.verbs[b.id].due);
  const fresh = verbs.filter((v) => !state.verbs[v.id]);
  const known = verbs.filter((v) => state.verbs[v.id] && state.verbs[v.id].due > now).sort((a, b) => state.verbs[a.id].ease - state.verbs[b.id].ease);
  const nextVerb = (ok: (v: Verb) => boolean = () => true): Verb | undefined => {
    const take = (v?: Verb) => (v && used.add(v.id), v);
    const d = due.find((v) => !used.has(v.id) && ok(v));
    if (d) return take(d);
    const f = fresh.filter((v) => !used.has(v.id) && ok(v));
    if (f.length) return take(weighted(f, (v) => need(state, ruleOf(v.kind)), random));
    return take(known.find((v) => !used.has(v.id) && ok(v)) ?? verbs.find((v) => !used.has(v.id) && ok(v)));
  };

  const recent = new Set(state.recent);
  const pick = <T extends { id: string; verb: string }>(list: T[]): T | undefined => {
    const open = list.filter((x) => !used.has(x.id) && !recent.has(x.id));
    const pool = open.length ? open : list.filter((x) => !used.has(x.id));
    const x = weighted(pool, (it) => {
      const v = byInf.get(it.verb);
      return v ? need(state, ruleOf(v.kind)) : 0.8;
    }, random);
    if (x) used.add(x.id);
    return x;
  };

  let auxTasks = 0;
  const tasks: Task[] = [];
  for (const type of PATTERN) {
    if (type === 'partizip') {
      const v = nextVerb();
      if (v) tasks.push({ type, verb: v.id });
    } else if (type === 'aux') {
      // The first one is always a sein verb: those are the ones to notice
      const v = nextVerb(auxTasks++ === 0 ? (x) => x.aux === 'sein' : undefined);
      if (v) tasks.push({ type, verb: v.id });
    } else if (type === 'order') {
      const x = pick(SENTENCES);
      if (x) tasks.push({ type, id: x.id });
    } else {
      const x = pick(TRANSFORMS);
      if (x) tasks.push({ type, id: x.id });
    }
  }
  return tasks;
}

/** Check one answer to one task. Null when the task doesn't exist or the answer has the wrong shape. */
export function checkTask(task: Task, given: Given, verbs: Verb[]): Checked | null {
  const verbById = (id: string) => verbs.find((v) => v.id === id);
  switch (task?.type) {
    case 'partizip': {
      const v = verbById(task.verb);
      return v && typeof given === 'string' ? checkPartizip(v, given.slice(0, 60)) : null;
    }
    case 'aux': {
      const v = verbById(task.verb);
      return v && (given === 'haben' || given === 'sein') ? checkAux(v, given as Aux) : null;
    }
    case 'order': {
      const s = sentence(task.id);
      return s && Array.isArray(given) && given.length <= 12 ? checkOrder(s, given) : null;
    }
    case 'transform': {
      const t = transform(task.id);
      return t && typeof given === 'string' ? checkTransform(t, verbs.find((v) => v.inf === t.verb), given.slice(0, 200)) : null;
    }
    default:
      return null;
  }
}

/** The verb a task practises, for its SM-2 schedule (tile sentences practise word order only). */
export function taskVerb(task: Task, verbs: Verb[]): Verb | undefined {
  if (task.type === 'partizip' || task.type === 'aux') return verbs.find((v) => v.id === task.verb);
  if (task.type === 'transform') {
    const t = transform(task.id);
    return t && verbs.find((v) => v.inf === t.verb);
  }
  return undefined;
}

export interface Outcome {
  state: PerfektState;
  answered: number;
  right: number;
  /** Rule scores before and after the session. */
  before: Record<RuleId, number | null>;
  after: Record<RuleId, number | null>;
  /** Verbs missed in this session (ids). */
  missed: string[];
}

/**
 * Apply a finished session's answers: each one is checked again here, then counts for its rule
 * (a right Präsens → Perfekt sentence counts for its verb's rule and for word order) and moves
 * its verb's schedule. Unknown tasks and malformed answers are skipped.
 */
export function applySession(prev: PerfektState, verbs: Verb[], answers: { task: Task; given: Given }[], now: number): Outcome {
  const state = sanitizeState(prev);
  const before = Object.fromEntries(RULES.map((r) => [r, ruleScore(state, r)])) as Outcome['before'];
  const push = (rule: RuleId, ok: boolean) => {
    state.rules[rule] = [...state.rules[rule], ok].slice(-KEEP);
  };
  let answered = 0;
  let right = 0;
  const missed: string[] = [];
  for (const { task, given } of answers.slice(0, MAX_ANSWERS)) {
    const c = checkTask(task, given, verbs);
    if (!c) continue;
    answered++;
    if (c.ok) right++;
    const verb = taskVerb(task, verbs);
    if (c.rule) push(c.rule, c.ok);
    if (task.type === 'transform' && c.ok && verb) push(ruleOf(verb.kind), true);
    if (verb) {
      state.verbs[verb.id] = { ...srsAnswer(state.verbs[verb.id] ?? null, c.ok ? 'good' : 'again', now, SRS_DEFAULTS, verb.id), log: [] };
      if (!c.ok && !missed.includes(verb.id)) missed.push(verb.id);
    }
    if ((task.type === 'order' || task.type === 'transform') && !state.recent.includes(task.id)) state.recent = [...state.recent, task.id].slice(-8);
  }
  if (answered) state.sessions += 1;
  const after = Object.fromEntries(RULES.map((r) => [r, ruleScore(state, r)])) as Outcome['after'];
  return { state, answered, right, before, after, missed };
}

/** Where a missed task comes back: three tasks later, or at the end. */
export function retryAt(index: number, length: number): number {
  return Math.min(length, index + 4);
}

/** What the trainer shows: each rule's recent answers, sessions done, verbs met and verbs due. */
export interface Progress {
  rules: Record<RuleId, boolean[]>;
  sessions: number;
  seen: number;
  due: number;
}

export function progressOf(state: PerfektState, now: number): Progress {
  const cards = Object.values(state.verbs);
  return { rules: state.rules, sessions: state.sessions, seen: cards.length, due: cards.filter((c) => c.due <= now).length };
}
