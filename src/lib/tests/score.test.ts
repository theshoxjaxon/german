import { describe, expect, it } from 'vitest';
import { TESTS } from '../server/tests';
import { allItems, cleanAnswers, emptyOpen, normalize, publicTest, scoreAttempt, shortParts } from './score';
import { isOpen, itemMax, type Answers, type OpenFeedback, type Test } from './types';

const FINAL: Test = {
  id: 'fixture', course: 'german', level: 'A1.1', kind: 'final', title: 'Fixture', subtitle: '', minutes: 1, topics: '', themes: '',
  sections: [
    { id: 'grammatik', points: 25, pass: 18, tasks: [{ id: 'g', title: '', instruction: '', instructionUz: '', items: [
      { id: 'g1', type: 'gap', prompt: 'Ich ___ Malika.', answer: ['heiße'] },
      { id: 'g2', type: 'gap', prompt: 'Er ___ Deutsch.', answer: ['spricht'] },
    ] }] },
    { id: 'lesen', points: 25, pass: 18, tasks: [{ id: 'l', title: '', instruction: '', instructionUz: '', items: [
      { id: 'l1', type: 'truefalse', prompt: '', answer: true },
      { id: 'l2', type: 'choice', prompt: '', options: ['a', 'b', 'c', 'd'], answer: 2 },
      { id: 'l3', type: 'truefalse', prompt: '', answer: false },
    ] }] },
    { id: 'schreiben', points: 25, pass: 18, tasks: [{ id: 's', title: '', instruction: '', instructionUz: '', items: [
      { id: 's1', type: 'form', label: 'Wohnort', answer: ['Köln'] },
      { id: 's2', type: 'writing', prompt: '', promptUz: '', points: ['a', 'b', 'c'], words: 30, model: 'Liebe Lena, …' },
    ] }] },
    { id: 'sprechen', points: 25, pass: 18, tasks: [{ id: 'p', title: '', instruction: '', instructionUz: '', items: [
      { id: 'p1', type: 'speaking', kind: 'intro', prompt: '', promptUz: '', cards: [], max: 3, model: 'Ich heiße …' },
    ] }] },
  ],
};
const UNIT: Test = {
  ...FINAL, id: 'unit', kind: 'unit',
  sections: [
    { id: 'grammatik', points: 2, tasks: [{ id: 'a', title: '', instruction: '', instructionUz: '', items: [
      { id: 'u1', type: 'choice', prompt: '', options: ['a', 'b', 'c', 'd'], answer: 1 },
      { id: 'u2', type: 'choice', prompt: '', options: ['a', 'b', 'c', 'd'], answer: 3 },
    ] }] },
    { id: 'lesen', points: 1, tasks: [{ id: 'b', title: '', instruction: '', instructionUz: '', items: [{ id: 'u3', type: 'truefalse', prompt: '', answer: true }] }] },
  ],
};
const ai = (points: number): OpenFeedback => ({ points, max: 0, summary: '', corrections: [], tip: '' });

describe('scoring a mock test', () => {
  it('compares typed answers kindly: case, spaces, final dot, and ae for ä', () => {
    expect(normalize('  Heisse. ')).toBe(normalize('heiße'));
    expect(normalize('Koeln')).toBe(normalize('Köln'));
    expect(normalize('22  Jahre')).toBe('22 jahre');
  });

  it('counts a Wiederholungstest in plain points, without pass or fail', () => {
    const r = scoreAttempt(UNIT, { u1: 1, u2: 0, u3: true });
    expect(r).toMatchObject({ score: 2, max: 3, complete: true, passed: null });
    expect(r.sections.map((s) => [s.id, s.score, s.max])).toEqual([['grammatik', 1, 2], ['lesen', 1, 1]]);
    expect(r.items.u2).toMatchObject({ ok: false, correct: 'd' });
  });

  it('scales each part of the final to 25 and waits for the AI on writing and speaking', () => {
    const answers: Answers = { g1: 'heisse', g2: 'sprecht', l1: true, l2: 2, l3: true, s1: 'koeln', s2: 'Liebe Lena …' };
    const r = scoreAttempt(FINAL, answers);
    const by = Object.fromEntries(r.sections.map((s) => [s.id, s]));
    expect(by.grammatik).toMatchObject({ raw: 1, rawMax: 2, score: 12.5, max: 25, pass: 18, pending: false });
    expect(by.lesen).toMatchObject({ raw: 2, rawMax: 3, score: 16.5 }); // 16.67 → half points
    expect(by.schreiben).toMatchObject({ raw: 1, rawMax: 11, pending: true });
    expect(r).toMatchObject({ max: 100, complete: false, passed: null });

    // The AI's scores complete it (kept within each task's maximum)
    const done = scoreAttempt(FINAL, answers, { s2: ai(9), p1: ai(5) });
    const sec = Object.fromEntries(done.sections.map((s) => [s.id, s]));
    expect(sec.schreiben).toMatchObject({ raw: 10, score: 22.5 });
    expect(sec.sprechen).toMatchObject({ raw: 3, score: 25 });
    expect(done).toMatchObject({ complete: true, score: 76.5, passed: false });
    expect(shortParts(done.sections).map((s) => s.id)).toEqual(['grammatik', 'lesen']);
  });

  it('passes the final only with 18 in every part, whatever the total', () => {
    const all: Answers = { g1: 'heiße', g2: 'spricht', l1: true, l2: 2, l3: false, s1: 'Köln' };
    expect(scoreAttempt(FINAL, all, { s2: ai(10), p1: ai(3) })).toMatchObject({ score: 100, passed: true });
    // Speaking 2 of 3 = 16.5 of 25: everything else perfect, still not passed
    const short = scoreAttempt(FINAL, all, { s2: ai(10), p1: ai(2) });
    expect(short.score).toBeGreaterThan(90);
    expect(short.passed).toBe(false);
    expect(shortParts(short.sections).map((s) => [s.id, s.score])).toEqual([['sprechen', 16.5]]);
  });

  it('scores writing and speaking left empty as 0 straight away', () => {
    expect(emptyOpen(FINAL, { s2: 'Liebe Lena', p1: '   ' })).toEqual({ p1: { points: 0, max: 3, summary: '', corrections: [], tip: '' } });
    expect(scoreAttempt(FINAL, {}, emptyOpen(FINAL, {}))).toMatchObject({ complete: true, score: 0, passed: false });
  });

  it('keeps only answers that fit the questions', () => {
    const clean = cleanAnswers(FINAL, { l2: 7, l1: 'yes', l3: true, g1: '  heiße ', s2: 'x'.repeat(5000), nope: 'x' });
    expect(clean).toEqual({ l3: true, g1: 'heiße', s2: 'x'.repeat(2000) });
    expect(cleanAnswers(FINAL, 'not an object')).toEqual({});
  });
});

describe('the built-in tests', () => {
  it('follow the class format: Wiederholungstests 25 + 5, the final 4 × 25 with 18 each', () => {
    const units = TESTS.filter((t) => t.kind === 'unit');
    const finals = TESTS.filter((t) => t.kind === 'final');
    expect(units.length).toBeGreaterThanOrEqual(4);
    expect(finals.length).toBeGreaterThanOrEqual(1);
    for (const t of units) {
      expect(t.sections.map((s) => [s.id, s.points, s.pass])).toEqual([['grammatik', 25, undefined], ['lesen', 5, undefined]]);
      const [grammar, reading] = t.sections.map((s) => s.tasks.flatMap((k) => k.items));
      expect(grammar.filter((i) => i.type === 'choice' && i.options.length === 4)).toHaveLength(25);
      expect(reading.filter((i) => i.type === 'truefalse')).toHaveLength(5);
    }
    for (const t of finals) {
      expect(t.sections.map((s) => [s.id, s.points, s.pass])).toEqual(['grammatik', 'lesen', 'schreiben', 'sprechen'].map((id) => [id, 25, 18]));
      const speaking = t.sections.find((s) => s.id === 'sprechen')!.tasks.flatMap((k) => k.items);
      expect(speaking.reduce((n, i) => n + itemMax(i), 0)).toBe(25); // the whiteboard's four tasks
      expect(speaking.map((i) => (i.type === 'speaking' ? i.kind : ''))).toEqual(['intro', 'partner', 'partner', 'partner', 'yesterday', 'cards']);
      expect(speaking.filter((i) => i.type === 'speaking' && i.kind === 'partner').every((i) => i.audio?.length)).toBe(true);
    }
  });

  it('are complete and consistent, and a perfect attempt gets full marks', () => {
    const ids = new Set<string>();
    for (const test of TESTS) {
      for (const section of test.sections) expect(section.tasks.flatMap((t) => t.items).length).toBeGreaterThan(0);
      for (const item of allItems(test)) {
        expect(ids.has(item.id), item.id).toBe(false);
        ids.add(item.id);
        if (item.type === 'choice') expect(item.answer >= 0 && item.answer < item.options.length, item.id).toBe(true);
        if (item.type === 'choice') expect(new Set(item.options).size, item.id).toBe(item.options.length);
        if (item.type === 'gap') expect(item.prompt.includes('___'), item.id).toBe(true);
        if (item.type === 'gap' || item.type === 'form') expect(item.answer.length, item.id).toBeGreaterThan(0);
        if (isOpen(item)) expect(item.model.length, item.id).toBeGreaterThan(20);
      }
      const perfect: Answers = {};
      const open: Record<string, OpenFeedback> = {};
      for (const item of allItems(test)) {
        if (item.type === 'choice' || item.type === 'truefalse') perfect[item.id] = item.answer;
        else if (item.type === 'gap' || item.type === 'form') perfect[item.id] = item.answer[0];
        else open[item.id] = ai(itemMax(item));
      }
      const max = test.sections.reduce((n, s) => n + s.points, 0);
      expect(scoreAttempt(test, perfect, open), test.id).toMatchObject({ score: max, max, complete: true, passed: test.kind === 'final' ? true : null });
    }
  });

  it('never send an answer or a model answer to the browser', () => {
    for (const test of TESTS) {
      const sent = publicTest(test);
      for (const item of sent.sections.flatMap((s) => s.tasks.flatMap((t) => t.items))) {
        expect('answer' in item || 'model' in item, item.id).toBe(false);
      }
    }
  });
});
