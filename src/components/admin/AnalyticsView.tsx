'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { PERIODS, type Analytics, type FunnelStep } from '@/lib/analytics';
import { dayLabelLong, dayLabelShortDe, dayLabelWithYear, rangeLabel } from '@/lib/stats';
import { plural } from '@/lib/time';
import { ColumnChart, Spark } from './charts';

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);
const dec = (x: number | null) => (x === null ? '–' : x.toFixed(1));
const at = <T,>(a: T[], fromEnd: number) => a[a.length - 1 - fromEnd];
/** Average of the last four weeks that have a value. */
const avg4 = (a: (number | null)[]) => {
  const v = a.slice(-4).filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** This week against last week, with an arrow and a sign so it doesn't rely on color. */
function Delta({ now, before, kind = 'count' }: { now: number | null; before: number | null; kind?: 'count' | 'pct' | 'dec' }) {
  if (now === null || before === null) return <span className="delta">no comparison yet</span>;
  const d = now - before;
  const size = kind === 'pct' ? Math.round(Math.abs(d) * 100) : kind === 'dec' ? Math.round(Math.abs(d) * 10) / 10 : Math.abs(d);
  if (size === 0) return <span className="delta">same as last week</span>;
  const text = kind === 'pct' ? `${size} pts` : kind === 'dec' ? size.toFixed(1) : String(size);
  return (
    <span className={`delta ${d > 0 ? 'up' : 'down'}`}>
      <span aria-hidden="true">{d > 0 ? '▲' : '▼'}</span> {d > 0 ? '+' : '−'}{text} vs last week
    </span>
  );
}

function InputTile({ label, values, kind, unit, note }: {
  label: string;
  values: (number | null)[];
  kind: 'count' | 'pct' | 'dec';
  unit?: string;
  note: string;
}) {
  const now = at(values, 0);
  const shown = kind === 'pct' ? pct(now) : kind === 'dec' ? dec(now) : String(now ?? '–');
  return (
    <div className="tile">
      <p className="tile-l">{label}</p>
      <p className="tile-v">{shown}{unit && now !== null && <span className="unit"> {unit}</span>}</p>
      <Delta now={now} before={at(values, 1)} kind={kind} />
      <p className="tile-s">{note}</p>
      <Spark values={values} />
    </div>
  );
}

function Funnel({ title, steps, drop }: { title: string; steps: FunnelStep[]; drop: Analytics['funnel']['biggestDrop'] }) {
  const top = steps[0].count;
  return (
    <div className="fn">
      <h3 className="fn-h">{title}</h3>
      <ol className="fn-list">
        {steps.map((s, i) => {
          const isDrop = !!drop && i > 0 && drop.from === steps[i - 1].label && drop.to === s.label;
          return (
            <li key={s.key} className={`fn-row${isDrop ? ' is-drop' : ''}`}>
              <div className="fn-text">
                <b>{s.label}</b>
                <span>{s.definition}</span>
              </div>
              <div className="fn-nums">
                <b>{s.count}</b>
                {s.base !== null && <span>{s.rate === null ? 'no one yet' : `${pct(s.rate)} of ${s.base}`}</span>}
              </div>
              <div className="fn-track" aria-hidden="true">
                <span className="fn-bar" style={{ width: top ? `${(s.count / top) * 100}%` : 0 }} />
              </div>
              {isDrop && <p className="fn-flag">Biggest drop-off</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AnalyticsView({ data }: { data: Analytics }) {
  const { users, weeks, northStar: ns, inputs, health, funnel } = data;
  const thisWeek = at(ns.perWeek, 0);
  const perLearner = at(inputs.activeLearners, 0) ? thisWeek / at(inputs.activeLearners, 0) : null;
  const lastIdx = weeks.length - 1;
  const weekLabels = weeks.map((w, i) => (i % 2 === lastIdx % 2 ? dayLabelShortDe(w.start) : ''));
  const weekName = (i: number) => (i === lastIdx ? 'This week' : i === lastIdx - 1 ? 'Last week' : rangeLabel(weeks[i].start, weeks[i].end));

  return (
    <main className="admin-main">
      <div className="page admin-page analytics">
        <header className="vhead">
          <div>
            <p className="eyebrow" lang="de">Lernzentrum · {dayLabelLong(data.today)}</p>
            <h1>Analytics</h1>
          </div>
        </header>
        {users.students === 0 && (
          <p className="notice" role="status">No students yet. The numbers fill in as students sign up and study.</p>
        )}

        <section aria-labelledby="users-h">
          <h2 id="users-h" className="sec-h">Users</h2>
          <div className="tiles tiles-6">
            <div className="tile"><p className="tile-l">Students</p><p className="tile-v">{users.students}</p><p className="tile-s">profiles, teachers not counted</p></div>
            <div className="tile"><p className="tile-l">New this week</p><p className="tile-v">{users.newThisWeek}</p><p className="tile-s">joined in the last 7 days</p></div>
            <div className="tile"><p className="tile-l">Active today</p><p className="tile-v">{users.activeToday}</p><p className="tile-s">answered 1+ card today</p></div>
            <div className="tile"><p className="tile-l">Active this week</p><p className="tile-v">{users.activeWeek}</p><p className="tile-s">of {users.students} studied in 7 days</p></div>
            <div className="tile"><p className="tile-l">Active this month</p><p className="tile-v">{users.activeMonth}</p><p className="tile-s">stickiness {pct(users.stickiness)}: daily ÷ monthly</p></div>
            <div className="tile"><p className="tile-l">Guests this week</p><p className="tile-v">{users.visitorsWeek}</p><p className="tile-s">opened the app without a profile</p></div>
          </div>
        </section>

        <section className="panel ns" aria-labelledby="ns-h">
          <p className="eyebrow">North Star</p>
          <h2 id="ns-h" className="ns-h">Words mastered per week</h2>
          <div className="ns-hero">
            <span className="ns-v">{thisWeek}</span>
            <Delta now={thisWeek} before={at(ns.perWeek, 1)} />
          </div>
          <p className="ns-sub">
            this week, by {plural(ns.learnersThisWeek, 'learner', 'learners')} · {dec(perLearner)} per active learner · {ns.total} mastered in total
          </p>
          <ColumnChart
            className="cols-12"
            labels={weekLabels}
            series={[{ values: ns.perWeek, className: 'seg-ns' }]}
            describe={(i) => `${weekName(i)}: ${plural(ns.perWeek[i], 'word', 'words')} mastered`}
          />
          <p className="fineprint">A word counts as mastered the first time its review gap reaches 21 days: the student came back over weeks and still remembered it.</p>
        </section>

        <section aria-labelledby="inputs-h">
          <h2 id="inputs-h" className="sec-h">What moves the North Star</h2>
          <div className="tiles">
            <InputTile label="Active learners" values={inputs.activeLearners} kind="count" note="answered a card this week" />
            <InputTile label="Study days" values={inputs.studyDays} kind="dec" unit="per learner" note="days with 1+ answer, of 7" />
            <InputTile label="New words started" values={inputs.newWords} kind="count" note="first answers on new cards" />
            <InputTile label="Recall rate" values={inputs.recallRate} kind="pct" note="reviews answered Good or Easy" />
          </div>
        </section>

        <section className="panel" aria-labelledby="funnel-h">
          <div className="panel-h fn-head">
            <h2 id="funnel-h">Student journey <span className="muted">(funnel)</span></h2>
            <nav className="seg" aria-label="Period">
              {PERIODS.map((p) => (
                <Link key={p.value} className="seg-btn" href={`/admin/analytics?period=${p.value}`} scroll={false}
                  aria-current={data.period === p.value ? 'true' : undefined}>
                  {p.label}
                </Link>
              ))}
            </nav>
          </div>
          <p className="fn-call">
            {funnel.biggestDrop
              ? <>Biggest drop-off: <b>{funnel.biggestDrop.from} → {funnel.biggestDrop.to}</b>, only {pct(funnel.biggestDrop.rate)} get through. Work on this step first.</>
              : 'Not enough people yet to compare the steps (each needs at least 3).'}
          </p>
          <div className="fn-grid">
            <Funnel title="Guests → profiles" steps={funnel.guests} drop={funnel.biggestDrop} />
            <Funnel title="New profiles → habit" steps={funnel.learners} drop={funnel.biggestDrop} />
          </div>
          <ul className="fineprint fn-notes">
            <li>{data.periodStart ? `People who first came between ${dayLabelWithYear(data.periodStart)} and today.` : 'Everyone since the start.'}</li>
            {funnel.joinedDirectly > 0 && <li>{plural(funnel.joinedDirectly, 'person', 'people')} signed up without trying as a guest first.</li>}
            {funnel.stillNew > 0 && <li>{plural(funnel.stillNew, 'person', 'people')} started less than 2 weeks ago: too early to count for Return.</li>}
            <li>{funnel.visitorsSince ? `Guest visits are counted since ${dayLabelWithYear(funnel.visitorsSince)}.` : 'Guest visits are counted from this update on; none yet.'}</li>
          </ul>
        </section>

        <section className="panel" aria-labelledby="health-h">
          <div className="panel-h"><h2 id="health-h">Health checks</h2><span className="muted">guardrails for healthy growth</span></div>
          <div className="atbl-scroll">
            <table className="atbl">
              <thead>
                <tr><th scope="col">Metric</th><th scope="col" className="num">This week</th><th scope="col" className="num">4-week avg</th><th scope="col">Why we watch it</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Recall rate</th><td className="num">{pct(at(inputs.recallRate, 0))}</td><td className="num">{pct(avg4(inputs.recallRate))}</td><td className="why">Too low: too many new words. Too high: too easy.</td></tr>
                <tr><th scope="row">Answers per study day</th><td className="num">{dec(at(health.answersPerStudyDay, 0))}</td><td className="num">{dec(avg4(health.answersPerStudyDay))}</td><td className="why">How heavy a study day is; watch for burnout.</td></tr>
                <tr><th scope="row">Cheers per learner</th><td className="num">{dec(at(health.cheersPerLearner, 0))}</td><td className="num">{dec(avg4(health.cheersPerLearner))}</td><td className="why">Is the class pulling together?</td></tr>
                <tr><th scope="row">Reviews</th><td className="num">{at(health.reviews, 0)}</td><td className="num">{Math.round(avg4(health.reviews) ?? 0)}</td><td className="why">How many answers the recall rate is based on.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="fineprint">Set healthy ranges once you have about a month of data; the 4-week average is your baseline.</p>
        </section>

        <section className="panel" aria-labelledby="ret-h">
          <div className="panel-h"><h2 id="ret-h">Retention by sign-up week</h2><span className="muted">share who studied</span></div>
          <div className="atbl-scroll">
            <table className="atbl cohort">
              <thead>
                <tr>
                  <th scope="col">Joined</th>
                  <th scope="col" className="num">People</th>
                  {data.cohorts[0]?.weeks.map((_, k) => <th key={k} scope="col" className="num">Wk {k + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((c) => (
                  <tr key={c.start}>
                    <th scope="row">{rangeLabel(c.start, c.end)}</th>
                    <td className="num">{c.size}</td>
                    {c.weeks.map((cell, k) =>
                      cell ? (
                        <td key={k} className={`num cell${cell.complete ? '' : ' is-partial'}`} style={{ '--p': Math.round(cell.rate * 100) } as CSSProperties}>
                          {pct(cell.rate)}
                        </td>
                      ) : <td key={k} />,
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fineprint">Wk 1 is each person’s first 7 days. Italic: that week isn’t over yet, so the number can still grow.</p>
        </section>

        <details className="panel weekly">
          <summary>Every weekly number as a table</summary>
          <div className="atbl-scroll">
            <table className="atbl">
              <thead>
                <tr>
                  <th scope="col">Week</th><th scope="col" className="num">Mastered</th><th scope="col" className="num">Active</th>
                  <th scope="col" className="num">Study days</th><th scope="col" className="num">New words</th><th scope="col" className="num">Recall</th>
                  <th scope="col" className="num">Answers/day</th><th scope="col" className="num">Cheers</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w, i) => i).reverse().map((i) => (
                  <tr key={weeks[i].start}>
                    <th scope="row">{rangeLabel(weeks[i].start, weeks[i].end)}</th>
                    <td className="num">{ns.perWeek[i]}</td>
                    <td className="num">{inputs.activeLearners[i]}</td>
                    <td className="num">{dec(inputs.studyDays[i])}</td>
                    <td className="num">{inputs.newWords[i]}</td>
                    <td className="num">{pct(inputs.recallRate[i])}</td>
                    <td className="num">{dec(health.answersPerStudyDay[i])}</td>
                    <td className="num">{dec(health.cheersPerLearner[i])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <p className="fineprint center">
          Weeks are the last 7 days, then the 7 before, and so on. Teachers (admins) aren’t counted.
          Page views and visitors from every browser are in Vercel → your project → Analytics.
        </p>
      </div>
    </main>
  );
}
