'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/client/i18n';
import { useStore } from '@/lib/client/store';
import { fetchTests, readDraft } from '@/lib/client/tests';
import { LEVELS, scoreTone, type AttemptDetail, type AttemptSummary, type Level, type TestInfo } from '@/lib/tests/types';
import { Icon, LoadError } from '../ui';
import { SpeakingCard } from './SpeakingCard';
import { TestResultView } from './TestResult';
import { TestRunner } from './TestRunner';

/** Your best attempt: the highest complete one, else the newest. */
function best(attempts: AttemptSummary[]): AttemptSummary | null {
  const done = attempts.filter((a) => a.complete);
  return done.length ? done.reduce((b, a) => (a.score > b.score ? a : b)) : attempts[0] ?? null;
}

/**
 * The Tests tab: the course's mock tests by level (A1.1 now; the later levels show as "opens
 * soon"), your best score on each, and the test or result you have open.
 */
export function TestsView({ active }: { active: boolean }) {
  const { me, course } = useStore();
  const { t, tn } = useT();
  const [data, setData] = useState<{ tests: TestInfo[]; attempts: AttemptSummary[]; ai: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AttemptDetail | string | null>(null);
  const [picked, setPicked] = useState<Level | null>(null);
  const [soon, setSoon] = useState<Level | null>(null);

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

  const open = new Set(data?.tests.map((x) => x.level));
  const level = picked && open.has(picked) ? picked : LEVELS.find((l) => open.has(l)) ?? LEVELS[0];
  const tests = data?.tests.filter((x) => x.level === level) ?? [];
  const groups = [
    { title: t('Wiederholungstests'), hint: t('Grammar and reading, like the paper tests: 30 points.'), list: tests.filter((x) => x.kind === 'unit') },
    { title: t('Abschlusstest'), hint: t('Grammar, reading, writing and speaking, 25 points each. You pass with 18 in every part.'), list: tests.filter((x) => x.kind === 'final') },
  ].filter((g) => g.list.length);

  return (
    <div className="page">
      <header className="vhead">
        <div>
          <p className="eyebrow">{course?.name}</p>
          <h1>{t('Mock tests')}</h1>
          <p className="vhead-lede">{t('A Wiederholungstest for each Modul, then the Abschlusstest, in the format of your class.')}</p>
        </div>
      </header>

      <div className="level-chips" role="tablist" aria-label={t('Level')}>
        {LEVELS.map((l) => {
          const available = open.has(l);
          return (
            <button key={l} type="button" role="tab" aria-selected={l === level} className={`chip level-chip${available ? '' : ' is-soon'}`}
              onClick={() => (available ? (setPicked(l), setSoon(null)) : setSoon(l))}
              aria-label={available ? l : t('{level}: opens soon', { level: l })}>
              {!available && <Icon name="lock" />}{l}
            </button>
          );
        })}
      </div>
      {soon && <p className="notice" role="status">{t('{level} opens soon. Keep practising with {open} for now.', { level: soon, open: level })}</p>}

      {level === 'A1.1' && course?.targetLang === 'de' && <SpeakingCard />}

      {error && !data ? <LoadError /> : !data ? (
        <div className="panel loading" aria-busy="true">{t('Loading the tests…')}</div>
      ) : !tests.length ? (
        <div className="panel empty"><p>{t('This course has no mock tests yet.')}</p></div>
      ) : (
        groups.map((g) => (
          <section key={g.title} className="test-group" aria-label={g.title}>
            <div className="test-group-h"><h2 lang="de">{g.title}</h2><p className="muted small">{g.hint}</p></div>
            <div className="test-list">
              {g.list.map((test) => {
                const mine = data.attempts.filter((a) => a.testId === test.id);
                const top = best(mine);
                const draft = !!readDraft(test.id);
                return (
                  <article key={test.id} className={`test-card${test.kind === 'final' ? ' is-final' : ''}`}>
                    <div className="test-card-h">
                      <div>
                        <h3 lang="de">{test.title} <span className="muted">· {test.subtitle}</span></h3>
                        <p className="muted small" lang="de">Themen: {test.themes}</p>
                      </div>
                      {top && (
                        <span className={`score-pill${scoreTone(top)}`}>
                          {top.score}<span className="pill-max">/{top.max}</span>
                        </span>
                      )}
                    </div>
                    <p className="muted small">{t(test.topics)}</p>
                    <p className="muted small">
                      {t('About {n} minutes', { n: test.minutes })}
                      {mine.length > 0 && <> · {tn(mine.length, '{n} attempt', '{n} attempts')}</>}
                      {top?.passed === true && <> · <b className="ok-text" lang="de">bestanden</b></>}
                      {top?.passed === false && <> · <span lang="de">nicht bestanden</span></>}
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
          </section>
        ))
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
