import { describe, expect, it } from 'vitest';
import { TESTS } from '../server/tests';
import { allItems, cleanAnswers, grade, normalize, publicTest, scoreAttempt } from './score';
import { isOpen, SECTIONS, type Test } from './types';

const FIXTURE: Test = {
  id: 'fixture', course: 'german', title: 'Fixture', subtitle: '', minutes: 1, topics: '',
  sections: [
    { id: 'hoeren', tasks: [{ id: 'h', title: '', instruction: '', instructionUz: '', items: [
      { id: 'h1', type: 'choice', prompt: '', options: ['a', 'b', 'c'], answer: 2 },
      { id: 'h2', type: 'truefalse', prompt: '', answer: false },
    ] }] },
    { id: 'lesen', tasks: [{ id: 'l', title: '', instruction: '', instructionUz: '', items: [
      { id: 'l1', type: 'truefalse', prompt: '', answer: true },
    ] }] },
    { id: 'grammatik', tasks: [{ id: 'g', title: '', instruction: '', instructionUz: '', items: [
      { id: 'g1', type: 'gap', prompt: 'Ich ___ Malika.', answer: ['heiße'] },
      { id: 'g2', type: 'gap', prompt: 'Er ___ Deutsch.', answer: ['spricht'] },
    ] }] },
    { id: 'schreiben', tasks: [{ id: 's', title: '', instruction: '', instructionUz: '', items: [
      { id: 's1', type: 'form', label: 'Wohnort', answer: ['Köln'] },
      { id: 's2', type: 'writing', prompt: '', promptUz: '', points: ['a', 'b', 'c'], words: 30, model: 'Liebe Lena, …' },
    ] }] },
    { id: 'sprechen', tasks: [{ id: 'p', title: '', instruction: '', instructionUz: '', items: [
      { id: 'p1', type: 'speaking', part: 1, prompt: '', promptUz: '', cards: [], max: 3, model: 'Ich heiße …' },
    ] }] },
  ],
};

describe('scoring a mock test', () => {
  it('compares typed answers kindly: case, spaces, final dot, and ae for ä', () => {
    expect(normalize('  Heisse. ')).toBe(normalize('heiße'));
    expect(normalize('Koeln')).toBe(normalize('Köln'));
    expect(normalize('22  Jahre')).toBe('22 jahre');
  });

  it('scores the automatic parts right away and waits for the AI on writing and speaking', () => {
    const r = scoreAttempt(FIXTURE, { h1: 2, h2: true, l1: true, g1: 'heisse', g2: 'sprecht', s1: 'koeln', s2: 'Liebe Lena …' });
    expect(r.items.h1).toMatchObject({ ok: true, correct: 'c' });
    expect(r.items.h2).toMatchObject({ ok: false, correct: 'falsch' });
    expect(r.items.g1.ok).toBe(true);
    expect(r.items.g2).toMatchObject({ ok: false, correct: 'spricht' });
    expect(r.items.s1.ok).toBe(true);
    expect(r.items.s2).toBeUndefined(); // the AI scores it
    const by = Object.fromEntries(r.sections.map((s) => [s.id, s]));
    expect(by.hoeren).toMatchObject({ raw: 1, rawMax: 2, score: 10, pending: false });
    expect(by.lesen.score).toBe(20);
    expect(by.grammatik.score).toBe(10);
    expect(by.schreiben).toMatchObject({ raw: 1, rawMax: 11, pending: true });
    expect(by.sprechen).toMatchObject({ raw: 0, rawMax: 3, pending: true });
    expect(r).toMatchObject({ complete: false, grade: null });

    // The AI's scores complete it (and are kept within each task's maximum)
    const done = scoreAttempt(FIXTURE, { h1: 2, h2: true, l1: true, g1: 'heisse', g2: 'sprecht', s1: 'koeln' }, {
      s2: { points: 9, max: 10, summary: '', corrections: [], tip: '' },
      p1: { points: 5, max: 3, summary: '', corrections: [], tip: '' },
    });
    const sec = Object.fromEntries(done.sections.map((s) => [s.id, s]));
    expect(sec.schreiben).toMatchObject({ raw: 10, score: 18, pending: false });
    expect(sec.sprechen).toMatchObject({ raw: 3, score: 20, pending: false });
    expect(done).toMatchObject({ complete: true, score: 78, grade: 'befriedigend' });
  });

  it('grades like the Goethe exam: 60 points pass', () => {
    expect([95, 85, 75, 60, 59.5].map(grade)).toEqual(['sehr gut', 'gut', 'befriedigend', 'ausreichend', 'nicht bestanden']);
  });

  it('keeps only answers that fit the questions', () => {
    const clean = cleanAnswers(FIXTURE, { h1: 7, h2: 'yes', l1: true, g1: '  heiße ', s2: 'x'.repeat(5000), nope: 'x' });
    expect(clean).toEqual({ l1: true, g1: 'heiße', s2: 'x'.repeat(2000) });
    expect(cleanAnswers(FIXTURE, 'not an object')).toEqual({});
  });
});

describe('the built-in tests', () => {
  it('are complete and consistent', () => {
    expect(TESTS.length).toBeGreaterThan(0);
    const ids = new Set<string>();
    for (const test of TESTS) {
      expect(test.sections.map((s) => s.id)).toEqual(SECTIONS.map((s) => s.id));
      for (const section of test.sections) expect(section.tasks.flatMap((t) => t.items).length).toBeGreaterThan(0);
      for (const item of allItems(test)) {
        expect(ids.has(item.id), item.id).toBe(false);
        ids.add(item.id);
        if (item.type === 'choice') expect(item.answer >= 0 && item.answer < item.options.length, item.id).toBe(true);
        if (item.type === 'gap') expect(item.prompt.includes('___'), item.id).toBe(true);
        if (item.type === 'gap' || item.type === 'form') expect(item.answer.length, item.id).toBeGreaterThan(0);
        if (isOpen(item)) expect(item.model.length, item.id).toBeGreaterThan(20);
      }
      // A perfect attempt scores 100 once the AI gives full marks
      const perfect: Record<string, number | boolean | string> = {};
      const open: Parameters<typeof scoreAttempt>[2] = {};
      for (const item of allItems(test)) {
        if (item.type === 'choice' || item.type === 'truefalse') perfect[item.id] = item.answer;
        else if (item.type === 'gap' || item.type === 'form') perfect[item.id] = item.answer[0];
        else open[item.id] = { points: item.type === 'writing' ? 10 : item.max, max: 0, summary: '', corrections: [], tip: '' };
      }
      expect(scoreAttempt(test, perfect, open)).toMatchObject({ score: 100, complete: true, grade: 'sehr gut' });
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
