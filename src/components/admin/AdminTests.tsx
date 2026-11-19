'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Course } from '@/lib/courses';
import { useClientValue } from '@/lib/client/hooks';
import { scoreTone, sectionMeta, type AttemptSummary, type TestInfo } from '@/lib/tests/types';
import { TestResultView } from '../tests/TestResult';
import { Avatar } from '../ui';
import { CourseBar } from './CourseBar';

type Attempt = AttemptSummary & { userId: string };
interface Person { id: string; displayName: string; avatarUrl: string | null }

/** The best attempt: the highest complete one, else the newest (attempts come newest first). */
function best(list: Attempt[]): Attempt | undefined {
  const done = list.filter((a) => a.complete);
  return done.length ? done.reduce((b, a) => (a.score > b.score ? a : b)) : list[0];
}

const pillClass = (a: Attempt) => `score-pill${scoreTone(a)}`;
const verdict = (a: Attempt) => (!a.complete ? 'writing and speaking not scored yet' : a.passed === true ? 'bestanden' : a.passed === false ? 'nicht bestanden' : `${a.score} of ${a.max} points`);
const SHORT: Record<string, string> = { hoeren: 'Hören', lesen: 'Lesen', grammatik: 'Gramm.', schreiben: 'Schreiben', sprechen: 'Sprechen' };
const when = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * /admin/tests: how the course does in the mock tests. A table of students × tests with each
 * best score, a summary per test, and the latest attempts; any score opens the whole attempt
 * (answers, writing, speech and the AI feedback). Names only, as on every teacher page.
 */
export function AdminTests({ course, courses, admin, tests, people, attempts }: {
  course: Course;
  courses: Course[];
  admin: boolean;
  tests: TestInfo[];
  people: Person[];
  attempts: Attempt[];
}) {
  const [open, setOpen] = useState<{ id: string; who: string } | null>(null);
  const mounted = useClientValue(() => true, false); // dates in the viewer's time zone
  const nameOf = new Map(people.map((p) => [p.id, p.displayName]));
  const mine = (userId: string, testId: string) => attempts.filter((a) => a.userId === userId && a.testId === testId);
  const show = (a: Attempt) => setOpen({ id: a.id, who: nameOf.get(a.userId) ?? '' });
  // People who took a test first, then the rest, by name
  const rows = [...people].sort((a, b) => {
    const ta = attempts.some((x) => x.userId === a.id) ? 0 : 1;
    const tb = attempts.some((x) => x.userId === b.id) ? 0 : 1;
    return ta - tb || a.displayName.localeCompare(b.displayName);
  });

  return (
    <main className="admin-main">
      <div className="page admin-page">
        <header className="vhead">
          <div>
            <p className="eyebrow">{course.name}</p>
            <h1>Mock tests</h1>
          </div>
          <Link className="btn" href={`/${course.id}`}>Open the app</Link>
        </header>
        <CourseBar course={course} courses={courses} admin={admin} />

        {!tests.length ? (
          <div className="panel"><p>This course has no mock tests yet. The German course has five (Lektion 1–12 and a final exam).</p></div>
        ) : (
          <>
            <div className="tiles tiles-6">
              {tests.map((test) => {
                const bests = people.map((p) => best(mine(p.id, test.id))).filter((a): a is Attempt => !!a && a.complete);
                const avg = bests.length ? Math.round(bests.reduce((s, a) => s + a.score, 0) / bests.length) : null;
                const passed = bests.filter((a) => a.passed === true).length;
                const max = test.kind === 'final' ? 100 : 30;
                return (
                  <div key={test.id} className="tile">
                    <p className="tile-l">{test.title} · {test.subtitle}</p>
                    <p className="tile-v">{avg ?? '–'}{avg !== null && <span className="unit"> / {max} avg</span>}</p>
                    <p className="tile-s">
                      {!bests.length ? 'nobody yet' : test.kind === 'final' ? `${passed} of ${bests.length} passed (18+ in every part)` : `${bests.length} took it`}
                    </p>
                  </div>
                );
              })}
            </div>

            <section className="panel people-panel" aria-labelledby="best-h">
              <div className="panel-h"><h2 id="best-h">Best scores</h2><span className="muted">of 100 · tap one to open it</span></div>
              <div className="people-scroll">
                <table className="tbl people tests-tbl">
                  <thead>
                    <tr>
                      <th scope="col" className="c-term th-plain">Name</th>
                      {tests.map((test) => (
                        <th key={test.id} scope="col" className="th-plain num"><span className="th-two">{test.title}<span className="muted">{test.subtitle}</span></span></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const count = attempts.filter((a) => a.userId === p.id).length;
                      return (
                        <tr key={p.id}>
                          <th scope="row" className="c-term">
                            <span className="term-cell">
                              <Avatar id={p.id} name={p.displayName} src={p.avatarUrl} size="sm" />
                              <span className="who">
                                <span className="name"><span className="nm">{p.displayName}</span></span>
                                <span className="meta">{count ? `${count} attempt${count === 1 ? '' : 's'}` : 'no tests yet'}</span>
                              </span>
                            </span>
                          </th>
                          {tests.map((test) => {
                            const list = mine(p.id, test.id);
                            const b = best(list);
                            return (
                              <td key={test.id} className="num">
                                {b ? (
                                  <button className={pillClass(b)} onClick={() => show(b)} title={`${verdict(b)} · ${list.length} attempt${list.length === 1 ? '' : 's'}`}
                                    aria-label={`${p.displayName}, ${test.title}: ${b.score} points${b.complete ? '' : ' so far'}. Open`}>
                                    {b.score}{!b.complete && '…'}
                                  </button>
                                ) : <span className="muted">–</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel" aria-labelledby="latest-h">
              <div className="panel-h"><h2 id="latest-h">Latest attempts</h2><span className="muted">points per part; under the pass mark in red</span></div>
              {!attempts.length ? <p className="muted">Nobody has taken a test yet.</p> : (
                <ul className="attempt-list">
                  {attempts.slice(0, 40).map((a) => {
                    const test = tests.find((x) => x.id === a.testId);
                    return (
                      <li key={a.id}>
                        <button className="attempt-row" onClick={() => show(a)}>
                          <span className={pillClass(a)}>{a.score}</span>
                          <span className="attempt-main">
                            <span>
                              <b>{nameOf.get(a.userId) ?? 'Someone'}</b> · {test ? `${test.title} (${test.subtitle})` : a.testId}
                              <span className="muted small"> · {mounted ? `${when(a.submittedAt)} · ` : ''}{verdict(a)}</span>
                            </span>
                            <span className="attempt-secs">
                              {a.sections.map((r) => (
                                <span key={r.id} lang="de" className={r.pass !== undefined && !r.pending && r.score < r.pass ? 'is-low' : ''}>
                                  {SHORT[r.id] ?? sectionMeta(r.id).title} <b>{r.pending ? '…' : r.score}</b>/{r.max}
                                </span>
                              ))}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <p className="hint center">Writing and speaking are scored by the AI after the student hands in; until then their score shows “…”.</p>
          </>
        )}
      </div>

      {open && <TestResultView attempt={open.id} ai onClose={() => setOpen(null)} asTeacher who={open.who} />}
    </main>
  );
}
