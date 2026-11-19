/**
 * Checking Perfekt answers, with feedback that names the rule behind a mistake ("‑ieren verbs
 * take no ge-"), not just "wrong". Pure functions: the trainer runs them for instant feedback,
 * and the server runs them again on the answers it is sent, so progress can't be faked.
 */
import { AUX_FORMS, separablePrefix, stemOf, weakEnding, type Aux, type OrderSentence, type RuleId, type Transform, type Verb, ruleOf } from './perfekt';

/** Why an answer is wrong. The trainer turns each code into a sentence. */
export type Code =
  | 'ok'
  | 'ieren-ge' // getelefoniert
  | 'insep-ge' // gebezahlt, geverstanden
  | 'sep-place' // gekauft / geeinkauft / einkauft for einkaufen
  | 'irregular-t' // gesprecht, geschlaft
  | 'regular-en' // gemachen
  | 'need-et' // gearbeit, gearbeitt
  | 'missing-ge' // macht, gessen
  | 'infinitive' // machen
  | 'spelling' // one letter off
  | 'wrong' // anything else
  | 'aux-sein' // haben where it takes sein
  | 'aux-haben' // sein where it takes haben
  | 'aux-person' // ich hat
  | 'no-aux'
  | 'aux-pos' // the helper verb isn't second
  | 'p-last' // the Partizip isn't last
  | 'subject' // the subject isn't first or right after the helper verb
  | 'incomplete'
  | 'other'; // a word other than the verbs differs

export interface Checked {
  ok: boolean;
  code: Code;
  right: string;
  /** The rule this answer counts for (null: it says nothing about any rule). */
  rule: RuleId | null;
  /** Right, with a note: written without ä/ö/ü/ß, or (tiles) the usual order is a little different. */
  hint?: 'umlaut' | 'order';
}

/** Lower case, ä→ae, ß→ss, single spaces, no full stop: what counts as "the same" answer. */
export function norm(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[.!?,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
/** Lower case with the umlauts dropped (ä → a): to forgive a missing umlaut, and only that. */
const plain = (s: string) => norm(s.normalize('NFC').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u'));

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** "machen (qilmoq) → ?" The student types the Partizip II. */
export function checkPartizip(verb: Verb, answer: string): Checked {
  const right = verb.p;
  const rule = ruleOf(verb.kind);
  const res = (code: Code, hint?: Checked['hint']): Checked => ({ ok: code === 'ok', code, right, rule, ...(hint ? { hint } : {}) });
  const got = norm(answer).replace(/^sich /, '').replace(/^(hat|ist) /, '');
  const want = norm(right);
  if (got === want) return res('ok');
  if (got && plain(answer).replace(/^sich /, '').replace(/^(hat|ist) /, '') === plain(right)) return res('ok', 'umlaut');
  if (!got) return res('wrong');
  const inf = norm(verb.inf).replace(/^sich /, '');
  if (got === inf) return res('infinitive');
  if (verb.kind === 'ieren' && got === `ge${want}`) return res('ieren-ge');
  if (verb.kind === 'inseparable' && got === `ge${want}`) return res('insep-ge');

  // Separable verbs: ge- goes between the prefix and the verb (ein|ge|kauft)
  const pre = verb.kind === 'separable' ? norm(separablePrefix(verb.inf, verb.p)) : '';
  if (pre && !got.startsWith(`${pre}ge`)) {
    const core = stemOf(inf.slice(pre.length)).slice(0, 3); // "kau" of kaufen
    if (got.startsWith('ge') || got.includes(core)) return res('sep-place');
  }

  // Judge the rest without the separable prefix: gekauft, gegessen
  const base = want.slice(pre.length);
  const stem = stemOf(inf.slice(pre.length));
  const gotBase = pre && got.startsWith(pre) ? got.slice(pre.length) : got;
  if (base.startsWith('ge') && (gotBase === base.slice(2) || (!gotBase.startsWith('ge') && distance(`ge${gotBase}`, base) <= 1))) return res('missing-ge');
  if (base.endsWith('en') && gotBase.startsWith('ge') && gotBase.endsWith('t')) return res('irregular-t');
  if (base === `ge${weakEnding(stem)}` && gotBase.endsWith('en')) return res('regular-en');
  if (base.endsWith('et') && (gotBase === `ge${stem}t` || gotBase === `ge${stem}`)) return res('need-et');
  if (distance(got, want) === 1) return res('spelling');
  return res('wrong');
}

/** "fahren → ___ gefahren": haben or sein? */
export function checkAux(verb: Verb, answer: Aux): Checked {
  const right = verb.aux;
  if (answer === right) return { ok: true, code: 'ok', right, rule: 'aux' };
  return { ok: false, code: right === 'sein' ? 'aux-sein' : 'aux-haben', right, rule: 'aux' };
}

/**
 * Sentence tiles in the order the student put them (indices into `sentence.tiles`, the decoy
 * helper verb being index tiles.length). Right when the helper verb is second, the Partizip last,
 * and the rest is the plain order with any one part moved to the front.
 */
export function checkOrder(sentence: OrderSentence, order: number[]): Checked {
  const { tiles } = sentence;
  const right = tiles.map((t) => t.w).join(' ');
  const res = (code: Code, hint?: Checked['hint']): Checked => ({ ok: code === 'ok', code, right, rule: 'aux', ...(hint ? { hint } : {}) });
  const valid = order.length === tiles.length && new Set(order).size === order.length && order.every((i) => Number.isInteger(i) && i >= 0 && i <= tiles.length);
  if (!valid) return res('incomplete');
  if (order.includes(tiles.length)) return res(tiles.find((t) => t.r === 'aux')!.w.match(/^(bin|bist|ist|sind|seid)$/) ? 'aux-sein' : 'aux-haben');
  const roles = order.map((i) => tiles[i].r);
  if (roles[1] !== 'aux') return res('aux-pos');
  if (roles[roles.length - 1] !== 'p') return res('p-last');
  const front = order[0];
  const middle = order.slice(2, -1);
  const plainOrder = tiles.map((_, i) => i).filter((i) => tiles[i].r !== 'aux' && tiles[i].r !== 'p' && i !== front);
  // The subject goes first, or right after the helper verb
  if (tiles[front].r !== 's' && tiles[middle[0]]?.r !== 's') return res('subject');
  // The bracket is right; another order of the middle words is still German, if less usual
  return middle.join() === plainOrder.join() ? res('ok') : res('ok', 'order');
}

/** Build the sentence a student made from tiles, with a capital letter and a full stop. */
export function writeOrder(sentence: OrderSentence, order: number[]): string {
  const words = order.map((i) => (i === sentence.tiles.length ? sentence.wrongAux : sentence.tiles[i]?.w ?? '')).filter(Boolean).join(' ');
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}.` : '';
}

/** "Ich kaufe ein Handy." → the student types the Perfekt sentence. */
export function checkTransform(item: Transform, verb: Verb | undefined, answer: string): Checked {
  const right = item.perfekt;
  const want = norm(right).split(' ');
  const got = norm(answer).split(' ').filter(Boolean);
  const verbRule = verb ? ruleOf(verb.kind) : null;
  const res = (code: Code, rule: RuleId | null, hint?: Checked['hint']): Checked => ({ ok: code === 'ok', code, right, rule, ...(hint ? { hint } : {}) });
  if (got.join(' ') === want.join(' ')) return res('ok', 'aux');
  if (got.length && plain(answer) === plain(right)) return res('ok', 'aux', 'umlaut');
  if (!got.length) return res('incomplete', null);

  const aux: Aux = AUX_FORMS.sein.includes(want.find((w) => AUX_FORMS.haben.includes(w) || AUX_FORMS.sein.includes(w)) ?? '') ? 'sein' : 'haben';
  const auxAt = want.findIndex((w) => AUX_FORMS[aux].includes(w));
  const gotAuxAt = got.findIndex((w) => AUX_FORMS.haben.includes(w) || AUX_FORMS.sein.includes(w));
  if (gotAuxAt < 0) return res('no-aux', 'aux');
  const gotAux = got[gotAuxAt];
  if (!AUX_FORMS[aux].includes(gotAux)) return res(aux === 'sein' ? 'aux-sein' : 'aux-haben', 'aux');
  if (gotAux !== want[auxAt]) return res('aux-person', 'aux');
  if (gotAuxAt !== auxAt) return res('aux-pos', 'aux');

  const p = want[want.length - 1];
  const last = got[got.length - 1];
  if (last !== p && got.includes(p)) return res('p-last', 'aux');
  if (last !== p && verb) {
    // Is the last word a wrong Partizip of this verb? Then say which rule.
    const c = checkPartizip(verb, last);
    if (c.ok) return res('other', null);
    if (c.code !== 'wrong' && c.code !== 'spelling') return { ...c, right, rule: verbRule };
    if (got.length === want.length && got.slice(0, -1).join(' ') === want.slice(0, -1).join(' ')) return { ...c, right, rule: verbRule };
    // The Partizip may be somewhere else in the sentence
    if (got.slice(0, -1).some((w) => checkPartizip(verb, w).ok)) return res('p-last', 'aux');
  }
  return res('other', null);
}
