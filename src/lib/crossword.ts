/**
 * Crossword builder: a pure function of (words, seed). Answers are folded letter for letter
 * (ä→A, ö→O, ü→U, ß→S) so a word's length never changes and "a" is accepted for "ä".
 */
import { splitTerm } from './text';
import type { Word } from './types';

export type CwWord = Pick<Word, 'id' | 'term' | 'meaning' | 'example'>;
export interface CwEntry {
  word: CwWord;
  answer: string; // folded, upper case
  display: string; // real spelling, upper case (ẞ for ß)
  row: number;
  col: number;
  dir: 'across' | 'down';
  num: number;
}
export interface Crossword { rows: number; cols: number; entries: CwEntry[] }

export const MIN_WORDS = 6;
export const MAX_SIZE = 13; // rows and columns, so the grid fits a phone screen
const FOLD: Record<string, string> = { Ä: 'A', Ö: 'O', Ü: 'U', ẞ: 'S' };
const upper = (s: string) => Array.from(s).map((c) => (c === 'ß' ? 'ẞ' : c.toUpperCase())).join('');
export const fold = (s: string) => Array.from(upper(s)).map((c) => FOLD[c] ?? c).join('');

/** The one German word a crossword can use from a term ("der Fuß" → "Fuß"); null for phrases. */
export function crosswordWord(term: string): string | null {
  const { rest } = splitTerm(term);
  return /^[A-Za-zÄÖÜäöüß]{3,10}$/.test(rest) ? rest : null;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Placed { w: CwWord; answer: string; display: string; r: number; c: number; dir: 'across' | 'down' }

function attempt(cands: { w: CwWord; answer: string; display: string }[], rand: () => number, max: number): Placed[] {
  const letters = new Map<string, string>(); // "r,c" → letter
  const used = new Map<string, Set<string>>(); // "r,c" → directions already using the cell
  const placed: Placed[] = [];
  const bb = { r0: 0, r1: 0, c0: 0, c1: 0 };
  const at = (r: number, c: number) => letters.get(`${r},${c}`);
  const cells = (p: { answer: string; r: number; c: number; dir: string }) =>
    Array.from(p.answer, (_, k) => [p.r + (p.dir === 'down' ? k : 0), p.c + (p.dir === 'across' ? k : 0)] as const);

  const fits = (answer: string, r: number, c: number, dir: 'across' | 'down') => {
    const dr = dir === 'down' ? 1 : 0, dc = 1 - dr;
    if (at(r - dr, c - dc) || at(r + dr * answer.length, c + dc * answer.length)) return -1; // would extend a neighbour
    let crossings = 0;
    for (let k = 0; k < answer.length; k++) {
      const rr = r + dr * k, cc = c + dc * k, have = at(rr, cc);
      if (have) {
        if (have !== answer[k] || used.get(`${rr},${cc}`)?.has(dir)) return -1;
        crossings++;
      } else if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1; // would touch a word sideways
    }
    return crossings;
  };
  const put = (p: Placed) => {
    if (placed.length) {
      const [lr, lc] = [p.r + (p.dir === 'down' ? p.answer.length - 1 : 0), p.c + (p.dir === 'across' ? p.answer.length - 1 : 0)];
      bb.r0 = Math.min(bb.r0, p.r); bb.c0 = Math.min(bb.c0, p.c); bb.r1 = Math.max(bb.r1, lr); bb.c1 = Math.max(bb.c1, lc);
    } else {
      bb.r1 = p.dir === 'down' ? p.answer.length - 1 : 0; bb.c1 = p.dir === 'across' ? p.answer.length - 1 : 0;
    }
    placed.push(p);
    cells(p).forEach(([r, c], k) => {
      letters.set(`${r},${c}`, p.answer[k]);
      (used.get(`${r},${c}`) ?? used.set(`${r},${c}`, new Set()).get(`${r},${c}`)!).add(p.dir);
    });
  };

  for (const cand of cands) {
    if (placed.length >= max) break;
    if (!placed.length) { put({ ...cand, r: 0, c: 0, dir: 'across' }); continue; }
    let best: { r: number; c: number; dir: 'across' | 'down'; score: number } | null = null;
    for (const [key, ch] of letters) {
      const [pr, pc] = key.split(',').map(Number);
      for (let i = 0; i < cand.answer.length; i++) {
        if (cand.answer[i] !== ch) continue;
        for (const dir of ['across', 'down'] as const) {
          const r = dir === 'down' ? pr - i : pr, c = dir === 'across' ? pc - i : pc;
          const x = fits(cand.answer, r, c, dir);
          if (x < 1) continue;
          const [lr, lc] = [r + (dir === 'down' ? cand.answer.length - 1 : 0), c + (dir === 'across' ? cand.answer.length - 1 : 0)];
          const h = Math.max(bb.r1, lr) - Math.min(bb.r0, r) + 1, w = Math.max(bb.c1, lc) - Math.min(bb.c0, c) + 1;
          if (h > MAX_SIZE || w > MAX_SIZE) continue;
          const score = x * 10 - (h * w - (bb.r1 - bb.r0 + 1) * (bb.c1 - bb.c0 + 1)) * 0.05 + rand(); // crossings first, then a compact grid, then a random tie-break
          if (!best || score > best.score) best = { r, c, dir, score };
        }
      }
    }
    if (best) put({ ...cand, r: best.r, c: best.c, dir: best.dir });
  }
  return placed;
}

const area = (ps: Placed[]) => {
  const rs = ps.flatMap((p) => [p.r, p.r + (p.dir === 'down' ? p.answer.length - 1 : 0)]);
  const cs = ps.flatMap((p) => [p.c, p.c + (p.dir === 'across' ? p.answer.length - 1 : 0)]);
  return (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
};

export function buildCrossword(words: CwWord[], seed: number, max = 12): Crossword | null {
  const seen = new Set<string>();
  const pool = words.flatMap((w) => {
    const rest = crosswordWord(w.term);
    const answer = rest && fold(rest);
    if (!rest || !answer || seen.has(answer)) return [];
    seen.add(answer);
    return [{ w, answer, display: upper(rest) }];
  });
  if (pool.length < MIN_WORDS) return null;

  let best: Placed[] = [];
  for (let n = 0; n < 40; n++) {
    const rand = rng(seed + n * 977);
    const cands = pool.map((p) => ({ p, k: rand() })).sort((a, b) => a.k - b.k).slice(0, max * 2).map((x) => x.p)
      .sort((a, b) => b.answer.length - a.answer.length);
    const got = attempt(cands, rand, max);
    if (got.length > best.length || (got.length === best.length && got.length && area(got) < area(best))) best = got;
  }
  if (best.length < MIN_WORDS) return null;

  const r0 = Math.min(...best.map((p) => p.r)), c0 = Math.min(...best.map((p) => p.c));
  const entries: CwEntry[] = best.map((p) => ({ word: p.w, answer: p.answer, display: p.display, row: p.r - r0, col: p.c - c0, dir: p.dir, num: 0 }));
  const starts = [...new Set(entries.map((e) => `${e.row},${e.col}`))]
    .sort((a, b) => { const [ar, ac] = a.split(',').map(Number), [br, bc] = b.split(',').map(Number); return ar - br || ac - bc; });
  entries.forEach((e) => (e.num = starts.indexOf(`${e.row},${e.col}`) + 1));
  entries.sort((a, b) => a.num - b.num || (a.dir === 'across' ? -1 : 1));
  const endR = Math.max(...entries.map((e) => e.row + (e.dir === 'down' ? e.answer.length - 1 : 0)));
  const endC = Math.max(...entries.map((e) => e.col + (e.dir === 'across' ? e.answer.length - 1 : 0)));
  return { rows: endR + 1, cols: endC + 1, entries };
}

/** Every filled cell of the grid: its expected (folded) letter, real spelling and the entries through it. */
export function gridCells(cw: Crossword) {
  const m = new Map<string, { r: number; c: number; ch: string; disp: string; entries: number[]; num: number }>();
  cw.entries.forEach((e, i) => {
    for (let k = 0; k < e.answer.length; k++) {
      const r = e.row + (e.dir === 'down' ? k : 0), c = e.col + (e.dir === 'across' ? k : 0), key = `${r},${c}`;
      const cell = m.get(key) ?? { r, c, ch: e.answer[k], disp: Array.from(e.display)[k], entries: [], num: 0 };
      cell.entries.push(i);
      if (k === 0) cell.num = e.num;
      m.set(key, cell);
    }
  });
  return m;
}
