import { describe, expect, it } from 'vitest';
import { parseList, suggestDeck } from './import-parser';
import { buildQueue, lessonNumber, orderNewWords, pickNext, quizArticle } from './queue';
import { packWords, SEED_PACKS } from './seed';
import { answer } from './srs';
import { cleanTerm, guessPos, highlightParts, norm, splitTerm } from './text';
import { DEFAULT_PREFS, type CardDoc, type StudyData } from './types';
import { EMPTY_FILTERS, visibleRows } from './words-view';

const NOW = Date.UTC(2026, 9, 12, 10);
const data = (cards: Record<string, CardDoc> = {}): StudyData => ({
  words: new Map(Object.entries(packWords(SEED_PACKS[0], NOW - 1000))), // the Lektion 3 list as a fixture
  cards: new Map(Object.entries(cards)),
  prefs: DEFAULT_PREFS,
});

describe('text helpers', () => {
  it('splits and normalises articles', () => {
    expect(splitTerm('die Familie')).toEqual({ art: 'die', rest: 'Familie' });
    expect(cleanTerm('Die   Familie')).toBe('die Familie');
    expect(guessPos('der Vater')).toBe('noun');
    expect(guessPos('sprechen')).toBe('verb');
    expect(guessPos('Welche Sprache sprichst du?')).toBe('phrase');
  });
  it('treats Uzbek apostrophe variants and umlauts as equal in search', () => {
    expect(norm('bo’limi')).toBe(norm("bo'limi"));
    expect(norm('oʻzbek')).toBe(norm("o'zbek"));
    expect(norm('Mütter')).toBe('mutter');
  });
  it('marks forms of the word inside the example', () => {
    const marked = highlightParts('Ich spreche ein bisschen Deutsch.', 'sprechen').filter((p) => p.mark).map((p) => p.text);
    expect(marked).toEqual(['spreche']);
  });
});

describe('import parser', () => {
  it('reads dash, tab and = separated lines and picks up the lesson name', () => {
    const r = parseList('Lektion 4\nDer Bruder – aka, uka\ndas Kind\tbola\nsprechen = gapirmoq\njunk line');
    expect(r.deckHint).toBe('Lektion 4');
    expect(r.pairs).toEqual([
      { term: 'der Bruder', meaning: 'aka, uka' },
      { term: 'das Kind', meaning: 'bola' },
      { term: 'sprechen', meaning: 'gapirmoq' },
    ]);
    expect(r.skipped).toEqual(['junk line']);
  });
  it('pairs alternating lines when there are no separators (PDF table paste)', () => {
    expect(parseList('Die Familie\noila\nDie Mutter\nona').pairs).toEqual([
      { term: 'die Familie', meaning: 'oila' },
      { term: 'die Mutter', meaning: 'ona' },
    ]);
  });
  it('suggests the next lesson', () => {
    expect(suggestDeck(['Lektion 2', 'Lektion 3'])).toBe('Lektion 4');
  });
});

describe('the class lesson', () => {
  const allPacks = (): StudyData => {
    const words = new Map<string, ReturnType<typeof packWords>[string]>();
    for (const pack of SEED_PACKS) for (const [id, w] of Object.entries(packWords(pack, NOW - 1000))) words.set(id, w);
    return { words, cards: new Map(), prefs: DEFAULT_PREFS };
  };
  const decksOf = (q: ReturnType<typeof buildQueue>) => [...new Set(q.fresh.map((x) => x.word.deck))];

  it('reads lesson numbers from deck names', () => {
    expect(lessonNumber('Lektion 10')).toBe(10);
    expect(lessonNumber(' lektion 2 ')).toBe(2);
    expect(lessonNumber('My words')).toBeNull();
    expect(lessonNumber(null)).toBeNull();
  });

  it('without one, brings in new words in book order', () => {
    expect(decksOf(buildQueue(allPacks(), NOW))[0]).toBe('Lektion 2');
  });

  it('starts "All decks" at the class lesson, goes back from there, and holds later lessons back', () => {
    const q = buildQueue({ ...allPacks(), classLesson: 'Lektion 8' }, NOW);
    expect(decksOf(q)).toEqual(['Lektion 8', 'Lektion 7', 'Lektion 5', 'Lektion 4', 'Lektion 3', 'Lektion 2']);
    expect(pickNext(q, NOW)?.word.deck).toBe('Lektion 8');
    // With both directions on, recognition still comes before production within a lesson
    const both = buildQueue({ ...allPacks(), classLesson: 'Lektion 8', prefs: { ...DEFAULT_PREFS, dirF: true, dirR: true } }, NOW);
    const l8 = both.fresh.filter((x) => x.word.deck === 'Lektion 8');
    expect(l8.findIndex((x) => x.dir === 'r')).toBeGreaterThan(0);
    expect(l8.findIndex((x) => x.dir === 'r')).toBeGreaterThan(l8.findLastIndex((x) => x.dir === 'f'));
  });

  it('leaves a chosen deck alone, even a later lesson', () => {
    const q = buildQueue({ ...allPacks(), classLesson: 'Lektion 8', prefs: { ...DEFAULT_PREFS, studyDeck: 'Lektion 10' } }, NOW);
    expect(decksOf(q)).toEqual(['Lektion 10']);
  });

  it('puts decks that are not lessons (your own words) after the lessons', () => {
    const w = (deck: string) => ({ word: { deck } as never });
    const out = orderNewWords([w('My words'), w('Lektion 2'), w('Lektion 9'), w('Lektion 4')], 'Lektion 4');
    expect(out.map((x) => (x.word as { deck: string }).deck)).toEqual(['Lektion 4', 'Lektion 2', 'My words']);
  });
});

describe('study queue', () => {
  it('starts with 20 new cards in list order', () => {
    const q = buildQueue(data(), NOW);
    expect(q.counts).toEqual({ fresh: 20, learning: 0, review: 0 });
    expect(pickNext(q, NOW)?.word.term).toBe('die Familie');
  });

  it('moves on to the next word after an answer (regression test)', () => {
    const f = answer(null, 'good', NOW);
    const q = buildQueue(data({ 'l3-familie': { f, r: null, suspended: false, updatedAt: NOW } }), NOW);
    expect(q.counts).toEqual({ fresh: 19, learning: 1, review: 0 });
    expect(pickNext(q, NOW)?.word.term).toBe('die Mutter');
    // 10 minutes later the learning card is due again and comes first
    expect(pickNext(buildQueue(data({ 'l3-familie': { f, r: null, suspended: false, updatedAt: NOW } }), NOW + 10 * 60_000), NOW + 10 * 60_000)?.word.term).toBe('die Familie');
  });

  it('skips paused words', () => {
    const q = buildQueue(data({ 'l3-familie': { f: null, r: null, suspended: true, updatedAt: NOW } }), NOW);
    expect(pickNext(q, NOW)?.word.term).toBe('die Mutter');
  });

  it('quizzes the article on recognition cards for nouns only', () => {
    const item = pickNext(buildQueue(data(), NOW), NOW)!; // die Familie
    expect(quizArticle(item, { genderQuiz: true })).toBe('die');
    expect(quizArticle(item, { genderQuiz: false })).toBe('');
    expect(quizArticle({ ...item, dir: 'r' }, { genderQuiz: true })).toBe(''); // production cards ask for the whole word
    expect(quizArticle({ ...item, word: { ...item.word, term: 'heißen' } }, { genderQuiz: true })).toBe(''); // no article
  });
});

describe('words view', () => {
  it('filters by gender and searches across fields', () => {
    const das = visibleRows(data(), NOW, '', { ...EMPTY_FILTERS, gender: ['das'] }, { key: 'source', dir: 'asc' });
    expect(das.map((r) => r.w.term)).toEqual(['das Enkelkind', 'das Fest', 'das Mitglied']);
    const hits = visibleRows(data(), NOW, "bo'limi", EMPTY_FILTERS, { key: 'source', dir: 'asc' });
    expect(hits).toHaveLength(2);
  });
  it('sorts A–Z by the noun, ignoring der/die/das', () => {
    const rows = visibleRows(data(), NOW, '', EMPTY_FILTERS, { key: 'term', dir: 'asc' });
    expect(rows.slice(0, 5).map((r) => r.w.term)).toEqual(['dein', 'doch', 'ein bisschen', 'das Enkelkind', 'die Familie']);
  });
});
