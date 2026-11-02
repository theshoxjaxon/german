'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { fetchAttempt, requestFeedback } from '@/lib/client/tests';
import {
  PASS_SCORE, SECTION_POINTS, SECTIONS,
  type AttemptDetail, type Item, type OpenFeedback, type OpenItem, type SectionResult,
} from '@/lib/tests/types';
import { Icon } from '../ui';
import { ReadTextView, Transcript } from './TestRunner';

const LETTERS = ['a', 'b', 'c', 'd'];

/** What someone answered, as text. */
function given(item: Item, v: string | number | boolean | undefined): string {
  if (v === undefined || v === '') return '—';
  if (item.type === 'choice' && typeof v === 'number') return `${LETTERS[v]}) ${item.options[v] ?? ''}`;
  if (item.type === 'truefalse') return v ? 'richtig' : 'falsch';
  return String(v);
}

/**
 * The result of an attempt: the score and grade, each section, and every answer with the right
 * one. Writing and speaking get the AI's feedback; when it is still missing it is asked for here.
 * Teachers open the same view from /admin/tests (`asTeacher`: no "try again", no new AI request).
 */
export function TestResultView({ attempt: start, ai, onClose, onRetry, onChange, asTeacher = false }: {
  attempt: AttemptDetail | string;
  ai: boolean;
  onClose: () => void;
  onRetry?: (testId: string) => void;
  onChange?: () => void;
  asTeacher?: boolean;
}) {
  const { t, lang } = useT();
  const [attempt, setAttempt] = useState<AttemptDetail | null>(typeof start === 'string' ? null : start);
  const [error, setError] = useState('');
  const [grading, setGrading] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (typeof start !== 'string') return;
    let live = true;
    fetchAttempt(start).then((a) => live && setAttempt(a), (e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [start]);

  const pending = !!attempt && !attempt.complete;
  const grade = async () => {
    if (!attempt) return;
    setGrading(true);
    setError('');
    try {
      setAttempt(await requestFeedback(attempt.id, lang));
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGrading(false);
    }
  };
  // Ask once, as soon as an attempt without writing and speaking scores is on screen
  useEffect(() => {
    if (!pending || !ai || asTeacher || asked.current || attempt?.aiError) return;
    asked.current = true;
    void grade();
  });

  if (!attempt) {
    return (
      <Shell title={t('Result')} onClose={onClose}>
        <div className="panel" aria-busy={!error}>{error ? <p className="err">{t(error)}</p> : t('Loading the result…')}</div>
      </Shell>
    );
  }

  const { result, test } = attempt;
  const passed = result.complete && result.score >= PASS_SCORE;
  return (
    <Shell title={`${test.title} · ${test.subtitle}`} onClose={onClose}>
      <section className={`result-hero${result.complete ? (passed ? ' is-pass' : ' is-fail') : ''}`} aria-live="polite">
        <p className="result-score"><b>{result.score}</b><span> / 100</span></p>
        {result.complete ? (
          <p className="result-grade"><span lang="de">{result.grade}</span> · {t(passed ? 'Passed' : 'Not passed yet: 60 points pass')}</p>
        ) : (
          <p className="result-grade">{t(grading ? 'Checking your writing and speaking…' : 'So far: writing and speaking aren’t scored yet.')}</p>
        )}
      </section>

      <section className="panel" aria-label={t('Sections')}>
        {SECTIONS.map((meta) => {
          const s = result.sections.find((x) => x.id === meta.id);
          return s ? <SectionBar key={meta.id} s={s} title={meta.title} label={t(meta.label)} /> : null;
        })}
      </section>

      {pending && !grading && (
        <div className="callout">
          <p>{t(attempt.aiError || error || (ai ? 'The AI couldn’t check your writing and speaking just now.' : 'The AI helper isn’t switched on, so writing and speaking aren’t scored. Compare your answers with the model answers below.'))}</p>
          {ai && !asTeacher && <button className="btn" onClick={() => void grade()}>{t('Check again')}</button>}
        </div>
      )}
      {grading && <div className="panel loading" aria-busy="true">{t('Checking your writing and speaking… this takes a few seconds.')}</div>}

      {test.sections.map((section) => {
        const meta = SECTIONS.find((m) => m.id === section.id);
        return (
          <details key={section.id} className="review-sec" open={section.id === 'schreiben' || section.id === 'sprechen'}>
            <summary><span lang="de">{meta?.title}</span> <span className="muted">· {t(meta?.label ?? '')}</span></summary>
            {section.tasks.map((task) => (
              <div key={task.id} className="review-task">
                <h4 lang="de">{task.title}</h4>
                {task.audio && <Transcript lines={task.audio} />}
                {task.texts?.map((x, i) => (
                  <details key={i} className="transcript"><summary>{t('Text')}</summary><ReadTextView text={x} /></details>
                ))}
                {task.items.map((item) =>
                  item.type === 'writing' || item.type === 'speaking' ? (
                    <OpenReview key={item.id} item={item} text={attempt.answers[item.id]} feedback={result.open[item.id]} />
                  ) : (
                    <div key={item.id} className={`rev-item${result.items[item.id]?.ok ? ' is-ok' : ' is-wrong'}`}>
                      {item.audio && <Transcript lines={item.audio} />}
                      <p className="rev-q" lang="de">{item.type === 'form' ? item.label : item.prompt}</p>
                      <p className="rev-a">
                        <Icon name={result.items[item.id]?.ok ? 'check' : 'x'} />
                        <span lang="de">{given(item, attempt.answers[item.id])}</span>
                        {!result.items[item.id]?.ok && <span className="rev-right" lang="de">→ {result.items[item.id]?.correct}</span>}
                      </p>
                    </div>
                  ),
                )}
              </div>
            ))}
          </details>
        );
      })}

      <div className="btn-row result-actions">
        {onRetry && !asTeacher && <button className="btn btn-primary" onClick={() => onRetry(test.id)}>{t('Try again')}</button>}
        <button className="btn" onClick={onClose}>{t('Close')}</button>
      </div>
    </Shell>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <div className="runner" role="dialog" aria-modal="true" aria-label={title}>
      <div className="rv-top">
        <button className="icon-btn" onClick={onClose} aria-label={t('Close')}><Icon name="x" /></button>
        <div className="runner-title"><b>{title}</b></div>
        <span />
      </div>
      <div className="runner-body">{children}</div>
    </div>
  );
}

function SectionBar({ s, title, label }: { s: SectionResult; title: string; label: string }) {
  return (
    <div className="sec-bar">
      <span className="sec-name"><b lang="de">{title}</b><span className="muted small">{label}</span></span>
      <span className="sec-track"><i style={{ width: `${(s.score / SECTION_POINTS) * 100}%` }} /></span>
      <span className="sec-n">{s.pending ? '…' : s.score}<span className="muted">/{SECTION_POINTS}</span></span>
    </div>
  );
}

function OpenReview({ item, text, feedback }: { item: OpenItem; text: string | number | boolean | undefined; feedback?: OpenFeedback }) {
  const { t } = useT();
  return (
    <div className="open-review">
      <p className="rev-q" lang="de">{item.prompt}</p>
      {item.type === 'writing' && <ul className="points" lang="de">{item.points.map((p) => <li key={p}>{p}</li>)}</ul>}
      {item.type === 'speaking' && <div className="cards-row" lang="de">{item.cards.map((c) => <span key={c} className="word-card">{c}</span>)}</div>}
      <p className="label">{t(item.type === 'writing' ? 'Your text' : 'What you said')}</p>
      <p className="your-text" lang="de">{typeof text === 'string' && text ? text : '—'}</p>
      {feedback && (
        <div className="feedback">
          <p className="fb-points"><b>{feedback.points}</b> / {feedback.max} {t('points')}</p>
          <p>{feedback.summary}</p>
          {feedback.corrections.length > 0 && (
            <ul className="corrections">
              {feedback.corrections.map((c, i) => (
                <li key={i}>
                  <span className="wrong" lang="de">{c.wrong}</span> → <span className="right" lang="de">{c.right}</span>
                  {c.why && <span className="why">{c.why}</span>}
                </li>
              ))}
            </ul>
          )}
          {feedback.tip && <p className="tip"><Icon name="star" /> {feedback.tip}</p>}
        </div>
      )}
      <details className="transcript">
        <summary>{t('Model answer')}</summary>
        <p className="your-text" lang="de">{item.model}</p>
      </details>
    </div>
  );
}
