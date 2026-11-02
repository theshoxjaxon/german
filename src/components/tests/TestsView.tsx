'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { useStore } from '@/lib/client/store';
import { fetchTests, readDraft } from '@/lib/client/tests';
import { PASS_SCORE, type AttemptDetail, type AttemptSummary, type TestInfo } from '@/lib/tests/types';
import { Icon, LoadError } from '../ui';
import { TestResultView } from './TestResult';
import { TestRunner } from './TestRunner';

/** Your best attempt: the highest complete one, else the newest. */
function best(attempts: AttemptSummary[]): AttemptSummary | null {
  const done = attempts.filter((a) => a.complete);
  return done.length ? done.reduce((b, a) => (a.score > b.score ? a : b)) : attempts[0] ?? null;
}

/** The Tests tab: the course's mock tests, your scores, and the test or result you have open. */
export function TestsView({ active }: { active: boolean }) {
  const { me, course } = useStore();
  const { t, tn } = useT();
  const [data, setData] = useState<{ tests: TestInfo[]; attempts: AttemptSummary[]; ai: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AttemptDetail | string | null>(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  // Refresh whenever the tab is opened, for another course, and after a test
  const courseId = course?.id;
  useEffect(() => {
    if (!active || !me) return;
    let live = true;
    fetchTests().then(
      (d) => {
        if (!live) return;
        setData(d);
        setError(false);
      },
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [active, me, courseId, version]);

  return (
    <div className="page">
      <header className="vhead">
        <div>
          <p className="eyebrow">{course?.name}</p>
          <h1>{t('Mock tests')}</h1>
          <p className="vhead-lede">{t('Practise for the exam like the Goethe A1: listening, reading, grammar, writing and speaking. 60 of 100 points pass.')}</p>
        </div>
      </header>

      {error && !data ? <LoadError /> : !data ? (
        <div className="panel loading" aria-busy="true">{t('Loading the tests…')}</div>
      ) : !data.tests.length ? (
        <div className="panel empty"><p>{t('This course has no mock tests yet.')}</p></div>
      ) : (
        <div className="test-list">
          {data.tests.map((test) => {
            const mine = data.attempts.filter((a) => a.testId === test.id);
            const top = best(mine);
            const draft = !!readDraft(test.id);
            return (
              <article key={test.id} className={`test-card${test.final ? ' is-final' : ''}`}>
                <div className="test-card-h">
                  <div>
                    <h2>{test.title} <span className="muted">· {test.subtitle}</span></h2>
                    {test.final && <span className="chip-now">{t('final exam')}</span>}
                  </div>
                  {top && (
                    <span className={`score-pill${!top.complete ? '' : top.score >= PASS_SCORE ? ' is-pass' : ' is-fail'}`} title={top.grade ?? undefined}>
                      {top.score}
                    </span>
                  )}
                </div>
                <p className="muted small">{t(test.topics)}</p>
                <p className="muted small">
                  {t('About {n} minutes', { n: test.minutes })}
                  {mine.length > 0 && <> · {tn(mine.length, '{n} attempt', '{n} attempts')}</>}
                  {top?.grade && <> · <span lang="de">{top.grade}</span></>}
                </p>
                <div className="btn-row">
                  <button className="btn btn-primary" onClick={() => setRunning(test.id)}>
                    <Icon name="clipboard" /> {t(draft ? 'Continue' : mine.length ? 'Try again' : 'Start')}
                  </button>
                  {mine[0] && <button className="btn" onClick={() => setViewing(mine[0].id)}>{t('Last result')}</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {running && (
        <TestRunner
          testId={running}
          onClose={() => {
            setRunning(null);
            load();
          }}
          onDone={(a) => {
            setRunning(null);
            setViewing(a);
            load();
          }}
        />
      )}
      {viewing && data && (
        <TestResultView
          attempt={viewing}
          ai={data.ai}
          onClose={() => setViewing(null)}
          onRetry={(id) => {
            setViewing(null);
            setRunning(id);
          }}
          onChange={load}
        />
      )}
    </div>
  );
}
