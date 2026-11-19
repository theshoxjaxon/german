'use client';

import { useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { RULES, ruleOf, type RuleId, type Verb } from '@/lib/grammar/perfekt';
import { Icon } from '../ui';
import { Bracket, RULE_TEXT, Screen, VerbForms } from './shared';

/** The rules from class, each with examples from the lesson verbs. */
const SECTIONS: { title: string; text: string; rule?: RuleId; examples?: string[]; sentences?: string[] }[] = [
  {
    title: '1. haben / sein + Partizip II',
    text: 'The Perfekt has two parts. The helper verb (haben or sein) is the 2nd part of the sentence; the Partizip II goes to the very end. Together they hold the sentence like a bracket.',
    sentences: ['Er [hat] gestern Fußball [gespielt].', 'Gestern [hat] er Fußball [gespielt].', 'Ich [bin] nach Berlin [gefahren].'],
  },
  {
    title: '2. Regular verbs: ge- … -t',
    text: 'ge- + the stem + -t. After -t or -d the ending is -et.',
    rule: 'regular',
    examples: ['machen', 'spielen', 'kaufen', 'arbeiten', 'warten'],
  },
  {
    title: '3. Separable verbs',
    text: 'ge- goes between the prefix and the verb.',
    rule: 'separable',
    examples: ['einkaufen', 'aufräumen', 'fernsehen', 'anrufen', 'ankommen'],
  },
  {
    title: '4. No ge-: -ieren, be-, ver-, er-',
    text: 'Verbs that end in -ieren, and verbs that start with be-, ver- or er-, take no ge-.',
    rule: 'noGe',
    examples: ['telefonieren', 'studieren', 'bezahlen', 'besuchen', 'verstehen'],
  },
  {
    title: '5. Irregular verbs: the table',
    text: 'Their Partizip II usually ends in -en, and the vowel often changes. Learn each one with its helper verb: hat gegessen, ist gefahren.',
    rule: 'irregular',
    examples: ['essen', 'schlafen', 'trinken', 'schreiben', 'denken'],
  },
  {
    title: 'haben or sein?',
    text: 'sein for moving from one place to another and for a change (fahren, gehen, kommen, fliegen, aufstehen), and for bleiben, sein and passieren. All other verbs take haben.',
    rule: 'aux',
    examples: ['fahren', 'gehen', 'aufstehen', 'bleiben', 'essen'],
  },
];

/** The rule sheet, colour-coded like the class notes, with every verb of the course below. */
export function RuleSheet({ verbs, onClose }: { verbs: Verb[]; onClose: () => void }) {
  const { t } = useT();
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState<RuleId | 'sein' | null>(null);
  const byInf = new Map(verbs.map((v) => [v.inf, v]));
  const shown = verbs
    .filter((v) => (filter === 'sein' ? v.aux === 'sein' : !filter || ruleOf(v.kind) === filter))
    .sort((a, b) => a.inf.replace(/^sich /, '').localeCompare(b.inf.replace(/^sich /, ''), 'de'));

  return (
    <Screen title={t('The Perfekt: the rules')} onClose={onClose} closeLabel={t('Close')}>
      <p className="gr-legend muted small">
        <b className="gr-box" lang="de">hat</b> {t('helper verb')} · <b className="gr-ge" lang="de">ge</b> {t('and the ending')} <b className="gr-end" lang="de">-t / -en</b> · <b className="gr-pre" lang="de">ein</b> {t('prefix')}
      </p>
      {SECTIONS.map((sec) => (
        <section key={sec.title} className="panel gr-rule-sec">
          <h2 className="gr-h" lang={sec.title.startsWith('1.') ? 'de' : undefined}>{t(sec.title)}</h2>
          <p>{t(sec.text)}</p>
          {sec.sentences && <ul className="gr-ex">{sec.sentences.map((x) => <li key={x}><Bracket text={x} /></li>)}</ul>}
          {sec.examples && (
            <ul className="gr-ex">
              {sec.examples.map((inf) => {
                const v = byInf.get(inf);
                return v ? <li key={inf}><VerbForms verb={v} /> <span className="muted small">{v.meaning}</span></li> : null;
              })}
            </ul>
          )}
        </section>
      ))}

      <section className="panel">
        <button className="btn btn-quiet gr-all-btn" aria-expanded={all} onClick={() => setAll((x) => !x)}>
          <Icon name={all ? 'down' : 'next'} /> {t('All verbs of the course ({n})', { n: verbs.length })}
        </button>
        {all && (
          <>
            <div className="chipset gr-chips" role="group" aria-label={t('Show')}>
              <button className="chip" aria-pressed={!filter} onClick={() => setFilter(null)}>{t('All')}</button>
              {RULES.filter((r) => r !== 'aux').map((r) => (
                <button key={r} className="chip" aria-pressed={filter === r} onClick={() => setFilter(r)}>{t(RULE_TEXT[r].label)}</button>
              ))}
              <button className="chip" aria-pressed={filter === 'sein'} onClick={() => setFilter('sein')} lang="de">ist …</button>
            </div>
            <ul className="gr-table">
              {shown.map((v) => (
                <li key={v.id}><VerbForms verb={v} /><span className="muted small">{v.meaning}</span></li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Screen>
  );
}
