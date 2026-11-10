import { describe, expect, it } from 'vitest';
import { checkAux, checkOrder, checkPartizip, checkTransform, norm, writeOrder } from './check';
import { buildVerbs, classify, parseForms, RULES, SENTENCES, sentence, transform, TRANSFORMS, writeTiles, type Verb } from './perfekt';
import { applySession, checkTask, emptyState, MAX_ANSWERS, pickSession, ruleLearned, ruleScore, sanitizeState, type Task } from './session';
import { perfektVerbs } from './verbs';

const verbs = perfektVerbs();
const v = (inf: string): Verb => {
  const found = verbs.find((x) => x.inf === inf);
  if (!found) throw new Error(`no verb ${inf}`);
  return found;
};

describe('the Perfekt verbs', () => {
  it('reads every lesson verb with its helper verb and Partizip, plus the extra verbs', () => {
    expect(verbs.length).toBeGreaterThanOrEqual(100);
    expect(v('fahren')).toMatchObject({ aux: 'sein', p: 'gefahren', kind: 'irregular', lesson: 'Lektion 7' });
    expect(v('sich freuen')).toMatchObject({ aux: 'haben', p: 'gefreut', kind: 'regular' });
    expect(v('machen')).toMatchObject({ aux: 'haben', p: 'gemacht', lesson: '' });
    expect(verbs.some((x) => x.inf === 'können' || x.inf === 'möchten')).toBe(false); // modal verbs aren't drilled
    expect(new Set(verbs.map((x) => x.id)).size).toBe(verbs.length);
  });

  it('classifies each verb by the rule that makes its Partizip II', () => {
    expect(classify('machen', 'gemacht')).toBe('regular');
    expect(classify('arbeiten', 'gearbeitet')).toBe('regular');
    expect(classify('zeichnen', 'gezeichnet')).toBe('regular');
    expect(classify('sammeln', 'gesammelt')).toBe('regular');
    expect(classify('einkaufen', 'eingekauft')).toBe('separable');
    expect(classify('aufräumen', 'aufgeräumt')).toBe('separable');
    expect(classify('fernsehen', 'ferngesehen')).toBe('separable');
    expect(classify('antworten', 'geantwortet')).toBe('regular'); // "an" here isn't a prefix
    expect(classify('telefonieren', 'telefoniert')).toBe('ieren');
    expect(classify('studieren', 'studiert')).toBe('ieren');
    expect(classify('essen', 'gegessen')).toBe('irregular');
    expect(classify('schlafen', 'geschlafen')).toBe('irregular');
    expect(classify('kennen', 'gekannt')).toBe('irregular');
    expect(classify('gehen', 'gegangen')).toBe('irregular');
    expect(classify('bezahlen', 'bezahlt')).toBe('inseparable');
    expect(classify('verstehen', 'verstanden')).toBe('inseparable');
    expect(classify('gefallen', 'gefallen')).toBe('inseparable');
    expect(classify('sich bedanken', 'bedankt')).toBe('inseparable');
  });

  it('reads the Perfekt out of a card\'s forms', () => {
    expect(parseForms('er fährt · fuhr · ist gefahren')).toEqual({ aux: 'sein', p: 'gefahren' });
    expect(parseForms('ich bedanke mich · bedankte sich · hat sich bedankt')).toEqual({ aux: 'haben', p: 'bedankt' });
    expect(parseForms('die Familien')).toBeNull();
    expect(buildVerbs([{ id: 'a', term: 'Rad fahren', meaning: '', forms: 'er fährt Rad · fuhr Rad · ist Rad gefahren', deck: '' }]).some((x) => x.id === 'a')).toBe(false);
  });

  it('has practice content that matches the verbs', () => {
    for (const s of SENTENCES) {
      expect(s.tiles.filter((t) => t.r === 'aux')).toHaveLength(1);
      expect(s.tiles.filter((t) => t.r === 's')).toHaveLength(1);
      expect(s.tiles[s.tiles.length - 1].r).toBe('p');
      expect(s.tiles[0].r).toBe('s');
      expect(v(s.verb).p).toBe(s.tiles[s.tiles.length - 1].w);
      expect(checkOrder(s, s.tiles.map((_, i) => i)).ok).toBe(true);
    }
    for (const t of TRANSFORMS) {
      const verb = v(t.verb);
      expect(t.perfekt.replace('.', '').split(' ').pop()).toBe(verb.p);
      expect(checkTransform(t, verb, t.perfekt)).toMatchObject({ ok: true, code: 'ok' });
    }
    expect(writeTiles(sentence('s1')!.tiles)).toBe('Er hat gestern Fußball gespielt.');
  });
});

describe('checking a Partizip II', () => {
  it('accepts the right form, written any case, with "hat" or a missing umlaut', () => {
    expect(checkPartizip(v('machen'), 'gemacht')).toMatchObject({ ok: true, code: 'ok', rule: 'regular' });
    expect(checkPartizip(v('machen'), ' Gemacht. ')).toMatchObject({ ok: true });
    expect(checkPartizip(v('machen'), 'hat gemacht')).toMatchObject({ ok: true });
    expect(checkPartizip(v('aufräumen'), 'aufgeraeumt')).toMatchObject({ ok: true, code: 'ok' });
    expect(checkPartizip(v('aufräumen'), 'aufgeraumt')).toMatchObject({ ok: true, hint: 'umlaut' });
    expect(checkPartizip(v('essen'), 'gegesen').ok).toBe(false); // ss is not an umlaut
  });

  it('names the rule behind each typical mistake', () => {
    expect(checkPartizip(v('telefonieren'), 'getelefoniert')).toMatchObject({ ok: false, code: 'ieren-ge', right: 'telefoniert', rule: 'noGe' });
    expect(checkPartizip(v('bezahlen'), 'gebezahlt')).toMatchObject({ code: 'insep-ge', rule: 'noGe' });
    expect(checkPartizip(v('einkaufen'), 'gekauft')).toMatchObject({ code: 'sep-place', right: 'eingekauft', rule: 'separable' });
    expect(checkPartizip(v('einkaufen'), 'geeinkauft')).toMatchObject({ code: 'sep-place' });
    expect(checkPartizip(v('einkaufen'), 'einkauft')).toMatchObject({ code: 'sep-place' });
    expect(checkPartizip(v('essen'), 'gessen')).toMatchObject({ code: 'missing-ge', right: 'gegessen', rule: 'irregular' });
    expect(checkPartizip(v('essen'), 'geesst')).toMatchObject({ code: 'irregular-t' });
    expect(checkPartizip(v('schlafen'), 'geschlaft')).toMatchObject({ code: 'irregular-t' });
    expect(checkPartizip(v('ankommen'), 'angekommt')).toMatchObject({ code: 'irregular-t' });
    expect(checkPartizip(v('machen'), 'gemachen')).toMatchObject({ code: 'regular-en', right: 'gemacht' });
    expect(checkPartizip(v('machen'), 'macht')).toMatchObject({ code: 'missing-ge' });
    expect(checkPartizip(v('arbeiten'), 'gearbeitt')).toMatchObject({ code: 'need-et' });
    expect(checkPartizip(v('machen'), 'machen')).toMatchObject({ code: 'infinitive' });
    expect(checkPartizip(v('trinken'), 'getrunkem')).toMatchObject({ code: 'spelling' });
    expect(checkPartizip(v('denken'), 'gedenkt')).toMatchObject({ code: 'wrong', right: 'gedacht' });
    expect(checkPartizip(v('machen'), '')).toMatchObject({ ok: false });
  });
});

describe('haben or sein', () => {
  it('explains which helper verb a verb takes', () => {
    expect(checkAux(v('fahren'), 'sein')).toMatchObject({ ok: true, rule: 'aux' });
    expect(checkAux(v('fahren'), 'haben')).toMatchObject({ ok: false, code: 'aux-sein', right: 'sein' });
    expect(checkAux(v('essen'), 'sein')).toMatchObject({ ok: false, code: 'aux-haben' });
  });
});

describe('building a sentence from tiles', () => {
  const s1 = sentence('s1')!; // er(0) hat(1) gestern(2) Fußball(3) gespielt(4); decoy "ist" = 5
  it('accepts any part in front when the helper verb is second and the Partizip last', () => {
    expect(checkOrder(s1, [0, 1, 2, 3, 4])).toMatchObject({ ok: true, code: 'ok' }); // Er hat gestern Fußball gespielt.
    expect(checkOrder(s1, [2, 1, 0, 3, 4])).toMatchObject({ ok: true, code: 'ok' }); // Gestern hat er Fußball gespielt.
    expect(checkOrder(s1, [3, 1, 0, 2, 4])).toMatchObject({ ok: true, code: 'ok' }); // Fußball hat er gestern gespielt.
    expect(writeOrder(s1, [2, 1, 0, 3, 4])).toBe('Gestern hat er Fußball gespielt.');
  });
  it('rejects a broken bracket, a misplaced subject or the wrong helper verb', () => {
    expect(checkOrder(s1, [0, 4, 1, 2, 3])).toMatchObject({ ok: false, code: 'aux-pos' }); // Er gespielt hat …
    expect(checkOrder(s1, [0, 1, 2, 4, 3])).toMatchObject({ ok: false, code: 'p-last' });
    expect(checkOrder(s1, [2, 1, 3, 0, 4])).toMatchObject({ ok: false, code: 'subject' }); // Gestern hat Fußball er gespielt.
    expect(checkOrder(s1, [0, 5, 2, 3, 4])).toMatchObject({ ok: false, code: 'aux-haben' }); // Er ist … gespielt
    expect(checkOrder(sentence('s4')!, [0, 5, 2, 3, 4])).toMatchObject({ ok: false, code: 'aux-sein' }); // sie hat … gefahren
    expect(checkOrder(s1, [0, 1, 2])).toMatchObject({ ok: false, code: 'incomplete' });
    expect(checkOrder(s1, [0, 0, 2, 3, 4])).toMatchObject({ ok: false, code: 'incomplete' });
  });
  it('accepts a less usual middle order, with a note', () => {
    expect(checkOrder(s1, [0, 1, 3, 2, 4])).toMatchObject({ ok: true, hint: 'order' }); // Er hat Fußball gestern gespielt.
  });
});

describe('Präsens → Perfekt', () => {
  const t = (id: string) => transform(id)!;
  const verb = (id: string) => v(t(id).verb);
  it('tolerates case, spacing and the full stop', () => {
    expect(checkTransform(t('t1'), verb('t1'), 'ich habe ein handy gekauft')).toMatchObject({ ok: true });
    expect(checkTransform(t('t1'), verb('t1'), '  Ich  habe ein Handy gekauft!')).toMatchObject({ ok: true });
    expect(checkTransform(t('t7'), verb('t7'), 'Du hast dein Zimmer aufgeraumt.')).toMatchObject({ ok: true, hint: 'umlaut' });
  });
  it('finds what is wrong: the helper verb, its person, its place, the Partizip', () => {
    expect(checkTransform(t('t8'), verb('t8'), 'Er hat nach Taschkent gefahren.')).toMatchObject({ ok: false, code: 'aux-sein', rule: 'aux' });
    expect(checkTransform(t('t1'), verb('t1'), 'Ich bin ein Handy gekauft.')).toMatchObject({ code: 'aux-haben' });
    expect(checkTransform(t('t1'), verb('t1'), 'Ich hat ein Handy gekauft.')).toMatchObject({ code: 'aux-person' });
    expect(checkTransform(t('t1'), verb('t1'), 'Ich ein Handy gekauft habe.')).toMatchObject({ code: 'aux-pos' });
    expect(checkTransform(t('t1'), verb('t1'), 'Ich habe gekauft ein Handy.')).toMatchObject({ code: 'p-last' });
    expect(checkTransform(t('t1'), verb('t1'), 'Ich kaufe ein Handy.')).toMatchObject({ code: 'no-aux' });
    expect(checkTransform(t('t5'), verb('t5'), 'Sie hat mit Anna getelefoniert.')).toMatchObject({ code: 'ieren-ge', rule: 'noGe' });
    expect(checkTransform(t('t6'), verb('t6'), 'Ich habe im Supermarkt gekauft.')).toMatchObject({ code: 'sep-place', rule: 'separable' });
    expect(checkTransform(t('t3'), verb('t3'), 'Wir haben Pizza geesst.')).toMatchObject({ code: 'irregular-t', rule: 'irregular' });
    expect(checkTransform(t('t1'), verb('t1'), 'Ich habe ein Hendy gekauft.')).toMatchObject({ ok: false, code: 'other', rule: null });
  });
  it('compares text the same way everywhere', () => {
    expect(norm('Straße, Äpfel!')).toBe('strasse aepfel');
  });
});

describe('a practice session', () => {
  const now = Date.UTC(2026, 10, 10, 12);
  const seq = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };

  it('has 10 tasks of four kinds, never the same kind twice in a row, without repeats', () => {
    const tasks = pickSession(verbs, emptyState(), now, seq(0.1, 0.7, 0.4, 0.9));
    expect(tasks).toHaveLength(10);
    expect(new Set(tasks.map((t) => t.type))).toEqual(new Set(['partizip', 'aux', 'order', 'transform']));
    for (let i = 1; i < tasks.length; i++) expect(tasks[i].type).not.toBe(tasks[i - 1].type);
    const keys = tasks.map((t) => ('verb' in t ? t.verb : t.id));
    expect(new Set(keys).size).toBe(keys.length);
    const firstAux = tasks.find((t) => t.type === 'aux') as { verb: string };
    expect(verbs.find((x) => x.id === firstAux.verb)!.aux).toBe('sein');
  });

  it('brings verbs that are due first', () => {
    const state = emptyState();
    const essen = v('essen');
    state.verbs[essen.id] = { type: 'learning', step: 0, due: now - 1000, ivl: 0, ease: 2.5, reps: 0, lapses: 0, first: now - 9e5, last: now - 9e5, log: [] };
    expect(pickSession(verbs, state, now)[0]).toEqual({ type: 'partizip', verb: essen.id });
  });

  it('leans toward the weakest rule', () => {
    const state = emptyState();
    state.rules.separable = Array(10).fill(false);
    state.rules.regular = Array(10).fill(true);
    state.rules.noGe = Array(10).fill(true);
    state.rules.irregular = Array(10).fill(true);
    let separable = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      for (const t of pickSession(verbs, state, now)) {
        if (t.type !== 'partizip') continue;
        total++;
        if (verbs.find((x) => x.id === t.verb)!.kind === 'separable') separable++;
      }
    }
    // Separable verbs are ~20% of all verbs; weak, they get far more than that
    expect(separable / total).toBeGreaterThan(0.35);
  });

  it('checks the answers again, moves the rule bars and each verb\'s schedule', () => {
    const essen = v('essen');
    const fahren = v('fahren');
    const answers: { task: Task; given: string | number[] }[] = [
      { task: { type: 'partizip', verb: essen.id }, given: 'geesst' },
      { task: { type: 'partizip', verb: essen.id }, given: 'gegessen' }, // the retry
      { task: { type: 'aux', verb: fahren.id }, given: 'sein' },
      { task: { type: 'order', id: 's1' }, given: [2, 1, 0, 3, 4] },
      { task: { type: 'transform', id: 't5' }, given: 'Sie hat mit Anna telefoniert.' },
      { task: { type: 'partizip', verb: 'nope' }, given: 'x' }, // unknown: skipped
      { task: { type: 'aux', verb: fahren.id }, given: 'maybe' }, // malformed: skipped
    ];
    const out = applySession(emptyState(), verbs, answers, now);
    expect(out.answered).toBe(5);
    expect(out.right).toBe(4);
    expect(out.state.rules.irregular).toEqual([false, true]);
    expect(out.state.rules.aux).toEqual([true, true, true]);
    expect(out.state.rules.noGe).toEqual([true]);
    expect(out.missed).toEqual([essen.id]);
    expect(out.before.irregular).toBeNull();
    expect(out.after.irregular).toBe(0.5);
    expect(out.state.verbs[essen.id].due).toBeGreaterThan(now);
    expect(out.state.verbs[essen.id].log).toEqual([]);
    expect(out.state.sessions).toBe(1);
    expect(out.state.recent).toEqual(['s1', 't5']);
  });

  it('can\'t be pushed past its limits', () => {
    const essen = v('essen');
    const many = Array.from({ length: 50 }, () => ({ task: { type: 'partizip', verb: essen.id } as Task, given: 'gegessen' }));
    const out = applySession(emptyState(), verbs, many, now);
    expect(out.answered).toBe(MAX_ANSWERS);
    expect(out.state.rules.irregular).toHaveLength(10);
    expect(ruleLearned(out.state, 'irregular')).toBe(true);
    expect(ruleScore(out.state, 'regular')).toBeNull();
    expect(checkTask({ type: 'order', id: 's1' }, 'text', verbs)).toBeNull();
    expect(checkTask({ type: 'transform', id: 't1' }, [1, 2], verbs)).toBeNull();
  });

  it('cleans a stored state', () => {
    expect(sanitizeState(null)).toEqual(emptyState());
    const s = sanitizeState({ rules: { regular: [true, 'x', false], aux: 'no' }, verbs: { a: { due: 1, ease: 2.5, log: [{}] }, b: 'bad' }, sessions: -3, recent: ['s1', 4] });
    expect(s.rules.regular).toEqual([true, false]);
    expect(s.rules.aux).toEqual([]);
    expect(Object.keys(s.verbs)).toEqual(['a']);
    expect(s.verbs.a.log).toEqual([]);
    expect(s.sessions).toBe(0);
    expect(s.recent).toEqual(['s1']);
    expect(RULES).toHaveLength(5);
  });
});
