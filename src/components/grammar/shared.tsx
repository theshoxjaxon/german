'use client';

import { useEffect, type ReactNode } from 'react';
import { useT } from '@/lib/client/i18n';
import type { Code } from '@/lib/grammar/check';
import { partizipParts, type RuleId, type Verb } from '@/lib/grammar/perfekt';
import { Icon } from '../ui';

/** The five rules, as the bars and the rule sheet name them. */
export const RULE_TEXT: Record<RuleId, { label: string; example: string }> = {
  regular: { label: 'Regular verbs: ge-…-t', example: 'machen → gemacht' },
  separable: { label: 'Separable verbs', example: 'einkaufen → eingekauft' },
  noGe: { label: 'No ge-: -ieren, be-, ver-', example: 'telefonieren → telefoniert' },
  irregular: { label: 'Irregular verbs (the table)', example: 'essen → gegessen' },
  aux: { label: 'haben or sein, word order', example: 'Er ist gefahren.' },
};

/** What each kind of mistake teaches. */
export const FEEDBACK: Record<Code, { text: string }> = {
  ok: { text: 'Right!' },
  'ieren-ge': { text: 'Verbs in -ieren take no ge-.' },
  'insep-ge': { text: 'Verbs that start with be-, ver- or er- take no ge-.' },
  'sep-place': { text: 'A separable verb: ge- goes between the prefix and the verb.' },
  'irregular-t': { text: 'An irregular verb from the table: its Partizip II ends in -en.' },
  'regular-en': { text: 'A regular verb: ge- + stem + -t, not -en.' },
  'need-et': { text: 'After -t or -d the ending is -et: gearbeitet, gewartet.' },
  'missing-ge': { text: 'The Partizip II starts with ge-.' },
  infinitive: { text: 'That is the infinitive. The Perfekt needs the Partizip II.' },
  spelling: { text: 'Almost: check the spelling.' },
  wrong: { text: 'Not this form.' },
  'aux-sein': { text: 'This verb takes sein: it means moving from one place to another, or a change (and bleiben, sein, passieren).' },
  'aux-haben': { text: 'This verb takes haben, like most verbs.' },
  'aux-person': { text: 'The helper verb must match the subject: ich habe / bin, du hast / bist, er hat / ist, wir haben / sind.' },
  'no-aux': { text: 'The Perfekt needs a helper verb: haben or sein.' },
  'aux-pos': { text: 'The helper verb (hat, ist …) is always the 2nd part of the sentence.' },
  'p-last': { text: 'The Partizip II goes to the very end.' },
  subject: { text: 'The subject goes first, or right after the helper verb.' },
  incomplete: { text: 'Use all the words.' },
  other: { text: 'The verbs are right; check the other words.' },
};

/** A Partizip II coloured like the class notes: ge- and the ending in red, the prefix in blue. */
export function Partizip({ verb }: { verb: Verb }) {
  return (
    <span className="gr-p" lang="de">
      {partizipParts(verb).map((part, i) => (part.mark ? <b key={i} className={`gr-${part.mark}`}>{part.text}</b> : <span key={i}>{part.text}</span>))}
    </span>
  );
}

/** "essen → hat gegessen" */
export function VerbForms({ verb }: { verb: Verb }) {
  return (
    <span lang="de" className="gr-forms">
      {verb.inf} → <span className="gr-aux">{verb.aux === 'sein' ? 'ist' : 'hat'}</span> <Partizip verb={verb} />
    </span>
  );
}

/** German with the helper verb and the Partizip boxed: "Er [hat] gestern Fußball [gespielt]." */
export function Bracket({ text }: { text: string }) {
  return (
    <span lang="de" className="gr-bracket">
      {text.split(/(\[[^\]]+\])/).map((part, i) => (part.startsWith('[') ? <b key={i} className="gr-box">{part.slice(1, -1)}</b> : <span key={i}>{part}</span>))}
    </span>
  );
}

/** A full-screen page over the app, like the test runner. Escape closes it. */
export function Screen({ title, sub, onClose, closeLabel, closeButton, children, foot, progress }: {
  title: string;
  sub?: string;
  onClose: () => void;
  closeLabel: string;
  /** Replaces the plain × (e.g. one that asks for a second tap); Escape then does nothing. */
  closeButton?: ReactNode;
  children: ReactNode;
  foot?: ReactNode;
  progress?: number;
}) {
  const plain = !closeButton;
  useEffect(() => {
    if (!plain) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, plain]);
  return (
    <div className="runner gr-screen" role="dialog" aria-modal="true" aria-label={title}>
      <div className="rv-top">
        {closeButton ?? <button className="icon-btn" onClick={onClose} aria-label={closeLabel}><Icon name="x" /></button>}
        <div className="runner-title">
          <b>{title}</b>
          {sub && <span className="muted small">{sub}</span>}
        </div>
        <span className="runner-time" />
      </div>
      <div className="rv-bar"><i style={{ width: `${(progress ?? 0) * 100}%` }} /></div>
      <div className="runner-body">{children}</div>
      {foot && <div className="runner-foot">{foot}</div>}
    </div>
  );
}

/** One rule's bar: the share right in its last answers. */
export function RuleBar({ rule, results }: { rule: RuleId; results: boolean[] }) {
  const { t } = useT();
  const right = results.filter(Boolean).length;
  const score = results.length ? right / results.length : 0;
  const learned = results.length >= 5 && score >= 0.8;
  const tone = !results.length ? '' : learned ? ' is-good' : score < 0.5 ? ' is-weak' : ' is-mid';
  return (
    <li className={`gr-rule${tone}`}>
      <div className="gr-rule-h">
        <span className="gr-rule-name">{t(RULE_TEXT[rule].label)}</span>
        <span className="gr-rule-n">
          {!results.length ? t('not practised yet') : learned ? <><Icon name="check" /> {t('learned')}</> : `${right}/${results.length}`}
        </span>
      </div>
      <div className="gr-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(score * 100)}
        aria-label={t('{rule}: {right} of the last {n} right', { rule: t(RULE_TEXT[rule].label), right, n: results.length })}>
        <i style={{ width: `${score * 100}%` }} />
      </div>
      <span className="gr-rule-ex muted small" lang="de">{RULE_TEXT[rule].example}</span>
    </li>
  );
}
