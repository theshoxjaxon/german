/** Input validation for the API routes. Anything a client sends is checked before it is stored. */
import { ID_RE } from '../text';
import { DEFAULT_PREFS, POS_OPTIONS, RATINGS, UI_LANGS, type CardDoc, type CardState, type CardType, type LogEntry, type Prefs, type WordData } from '../types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const CARD_TYPES: CardType[] = ['new', 'learning', 'review', 'relearning'];
const POS_KEYS = POS_OPTIONS.map(([k]) => k);

export const isValidId = (id: unknown): id is string => typeof id === 'string' && ID_RE.test(id);

export function sanitizeWord(v: unknown): WordData | null {
  if (!isObj(v)) return null;
  const term = str(v.term, 200);
  const meaning = str(v.meaning, 500);
  if (!term || !meaning) return null;
  const now = Date.now();
  return {
    term,
    meaning,
    pos: POS_KEYS.includes(v.pos as never) ? (v.pos as WordData['pos']) : 'other',
    pronunciation: str(v.pronunciation, 200),
    forms: str(v.forms, 300),
    example: str(v.example, 1000),
    exampleTr: str(v.exampleTr, 1000),
    mnemonic: str(v.mnemonic, 1000),
    notes: str(v.notes, 2000),
    tags: Array.isArray(v.tags) ? [...new Set(v.tags.map((t) => str(t, 40)).filter(Boolean))].slice(0, 20) : [],
    deck: str(v.deck, 80),
    order: num(v.order),
    createdAt: num(v.createdAt, now),
    updatedAt: num(v.updatedAt, now),
  };
}

function sanitizeState(v: unknown): CardState | null {
  if (!isObj(v) || !CARD_TYPES.includes(v.type as CardType)) return null;
  const log: LogEntry[] = Array.isArray(v.log)
    ? v.log
        .filter((e): e is Record<string, unknown> => isObj(e) && RATINGS.includes(e.r as never) && CARD_TYPES.includes(e.k as never))
        .slice(-30)
        .map((e) => ({ t: num(e.t), r: e.r as LogEntry['r'], k: e.k as CardType, i: num(e.i) }))
    : [];
  return {
    type: v.type as CardType,
    step: num(v.step),
    due: num(v.due),
    ivl: num(v.ivl),
    ease: Math.max(1.3, Math.min(5, num(v.ease, 2.5))),
    reps: num(v.reps),
    lapses: num(v.lapses),
    first: num(v.first),
    last: num(v.last),
    log,
  };
}

export function sanitizeCard(v: unknown): CardDoc | null {
  if (!isObj(v)) return null;
  return { f: sanitizeState(v.f), r: sanitizeState(v.r), suspended: v.suspended === true, updatedAt: num(v.updatedAt, Date.now()) };
}

const steps = (v: unknown, fallback: number[]) => {
  if (!Array.isArray(v)) return fallback;
  const s = v.filter((n): n is number => typeof n === 'number' && n > 0 && n <= 1440).slice(0, 6);
  return s.length ? s : fallback;
};
const clamp = (v: unknown, lo: number, hi: number, fallback: number) => Math.min(hi, Math.max(lo, Math.round(num(v, fallback))));

export function sanitizePrefs(v: unknown, base: Prefs = DEFAULT_PREFS): Prefs {
  if (!isObj(v)) return base;
  const bonus = isObj(v.bonusNew) ? { day: num(v.bonusNew.day), n: clamp(v.bonusNew.n, 0, 1000, 0) } : null;
  return {
    newPerDay: clamp(v.newPerDay, 0, 200, base.newPerDay),
    maxReviews: clamp(v.maxReviews, 10, 2000, base.maxReviews),
    dirF: typeof v.dirF === 'boolean' ? v.dirF : base.dirF,
    dirR: typeof v.dirR === 'boolean' ? v.dirR : base.dirR,
    learnSteps: steps(v.learnSteps, base.learnSteps),
    relearnSteps: steps(v.relearnSteps, base.relearnSteps),
    autoplay: typeof v.autoplay === 'boolean' ? v.autoplay : base.autoplay,
    ttsLang: /^[a-z]{2}(-[A-Z]{2})?$/.test(String(v.ttsLang)) ? String(v.ttsLang) : base.ttsLang,
    slowSpeech: typeof v.slowSpeech === 'boolean' ? v.slowSpeech : base.slowSpeech,
    genderQuiz: typeof v.genderQuiz === 'boolean' ? v.genderQuiz : base.genderQuiz,
    dailyGoal: clamp(v.dailyGoal, 0, 500, base.dailyGoal),
    ...(UI_LANGS.includes(v.uiLang as never) ? { uiLang: v.uiLang as Prefs['uiLang'] } : base.uiLang ? { uiLang: base.uiLang } : {}),
    studyDeck: typeof v.studyDeck === 'string' ? v.studyDeck.slice(0, 80) : base.studyDeck,
    bonusNew: bonus,
  };
}
