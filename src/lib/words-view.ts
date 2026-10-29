/** Search, filter and sort for the Words (database) tab. */
import { compareText, sortedWords, wordInfo, type WordInfo } from './queue';
import { langOf } from './courses';
import { genderOf, norm, splitTerm } from './text';
import { dayIndex } from './time';
import { POS_LABEL, type StudyData, type Word } from './types';

export type FilterGroup = 'deck' | 'status' | 'gender' | 'pos' | 'tag';
export type Filters = Record<FilterGroup, string[]>;
export const EMPTY_FILTERS: Filters = { deck: [], status: [], gender: [], pos: [], tag: [] };
export const FILTER_LABEL: Record<FilterGroup, string> = { deck: 'Deck', status: 'Status', gender: 'Gender', pos: 'Type', tag: 'Tag' };
export const STATUS_OPTS: [string, string][] = [
  ['new', 'New'], ['learning', 'Learning'], ['due', 'Due today'], ['review', 'Review'], ['leech', 'Leech'], ['suspended', 'Paused'],
];

export type SortKey = 'source' | 'term' | 'meaning' | 'due' | 'ease' | 'lapses' | 'ivl' | 'status' | 'pos' | 'deck' | 'added'
  | 'pronunciation' | 'forms' | 'example' | 'exampleTr' | 'mnemonic' | 'notes';
export interface Sort { key: SortKey; dir: 'asc' | 'desc' }

export const SORTS: Partial<Record<SortKey, { label: string; short: string; dir: 'asc' | 'desc' }>> = {
  source: { label: 'List order', short: 'List order', dir: 'asc' },
  term: { label: 'Word A–Z (ignores der/die/das)', short: 'Word A–Z', dir: 'asc' },
  meaning: { label: 'Meaning A–Z', short: 'Meaning', dir: 'asc' },
  due: { label: 'Due date', short: 'Due', dir: 'asc' },
  ease: { label: 'Ease, hardest first', short: 'Ease', dir: 'asc' },
  lapses: { label: 'Lapses, most first', short: 'Lapses', dir: 'desc' },
  ivl: { label: 'Interval', short: 'Interval', dir: 'asc' },
  status: { label: 'Status', short: 'Status', dir: 'asc' },
  pos: { label: 'Type', short: 'Type', dir: 'asc' },
  deck: { label: 'Deck', short: 'Deck', dir: 'asc' },
  added: { label: 'Date added, newest first', short: 'Newest', dir: 'desc' },
};

export const activeFilterCount = (f: Filters) => Object.values(f).reduce((n, list) => n + list.length, 0);

export interface Row {
  w: Word;
  i: WordInfo;
}

function sortValue(key: SortKey, w: Word, i: WordInfo, articles: boolean): string | number | null {
  switch (key) {
    case 'term': return splitTerm(w.term, articles).rest;
    case 'status': return ['learning', 'review', 'new', 'suspended'].indexOf(i.status);
    case 'due': return i.dueMs;
    case 'ease': return i.ease;
    case 'ivl': return i.ivl;
    case 'lapses': return i.lapses;
    case 'pos': return POS_LABEL[w.pos] || '';
    case 'added': return w.createdAt || 0;
    case 'meaning': case 'deck': case 'pronunciation': case 'forms': case 'example': case 'exampleTr': case 'mnemonic': case 'notes':
      return w[key] || '';
    default: return null;
  }
}

export function matchesStatus(value: string, i: WordInfo): boolean {
  return value === 'due' ? i.dueToday : value === 'leech' ? i.leech : i.status === value;
}

export function visibleRows(data: StudyData, now: number, q: string, f: Filters, sort: Sort): Row[] {
  const today = dayIndex(now);
  const qn = norm(q);
  const { articles } = langOf(data.course);
  const rows: Row[] = [];
  for (const w of sortedWords(data.words)) {
    const i = wordInfo(data, w, today);
    if (f.deck.length && !f.deck.includes(w.deck || '')) continue;
    if (f.gender.length && articles && !f.gender.includes(genderOf(w.term) || 'none')) continue;
    if (f.pos.length && !f.pos.includes(w.pos || 'other')) continue;
    if (f.tag.length && !(w.tags || []).some((t) => f.tag.includes(t))) continue;
    if (f.status.length && !f.status.some((s) => matchesStatus(s, i))) continue;
    if (qn) {
      const hay = norm([w.term, w.meaning, w.pronunciation, w.forms, w.example, w.exampleTr, w.mnemonic, w.notes, w.deck, ...(w.tags || [])].join(' \u0001 '));
      if (!hay.includes(qn)) continue;
    }
    rows.push({ w, i });
  }
  if (sort.key === 'source') {
    if (sort.dir === 'desc') rows.reverse();
    return rows;
  }
  const sign = sort.dir === 'desc' ? -1 : 1;
  // Array.prototype.sort is stable, so ties keep list order.
  return rows.sort((a, b) => {
    const va = sortValue(sort.key, a.w, a.i, articles);
    const vb = sortValue(sort.key, b.w, b.i, articles);
    const ea = va == null || va === '';
    const eb = vb == null || vb === '';
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1; // empty values always last
    return sign * (typeof va === 'number' && typeof vb === 'number' ? va - vb : compareText(String(va), String(vb)));
  });
}

export function toCSV(rows: Row[]): string {
  const cols = ['term', 'meaning', 'pronunciation', 'pos', 'forms', 'example', 'exampleTr', 'mnemonic', 'notes', 'tags', 'deck'] as const;
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join(', ') : String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(({ w }) => cols.map((c) => cell(w[c])).join(','))].join('\n');
}
