'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createClubAction, deleteClubAction } from '@/app/admin/actions';
import type { Course } from '@/lib/courses';
import { useClientValue } from '@/lib/client/hooks';
import { REASON_LABEL, type StudyAdminView } from '@/lib/study/types';
import { cityOf, DAYS, FIRST_HOUR, LAST_HOUR, slotStart } from '@/lib/study/week';

const MIN_SIGNUPS = 3; // as on the server (study.ts): the heatmap waits for 3 sign-ups
import { DAY_NAMES } from '../study/StudyTogether';
import { ConfirmButton } from '../ui';
import { CourseBar } from './CourseBar';

const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const pad = (n: number) => String(n).padStart(2, '0');
/** An instant as the value of <input type="datetime-local"> (this browser's time zone). */
const localInput = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const when = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * /admin/study: when the class is free next week (how many, never who), the speaking clubs and
 * the reports from study chats (who reported whom and why). Chats themselves can't be read here
 * or anywhere else.
 */
export function AdminStudy({ course, courses, admin, view }: { course: Course; courses: Course[]; admin: boolean; view: StudyAdminView }) {
  const mounted = useClientValue(() => true, false); // times in this browser's time zone
  const [at, setAt] = useState('');
  const [place, setPlace] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const max = Math.max(1, ...Object.values(view.heat));
  const best = Object.entries(view.heat).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0])).slice(0, 3);
  const label = (slot: number) => `${DAY_NAMES[Math.floor(slot / 24)].short} ${slot % 24}:00`;

  const addClub = () =>
    start(async () => {
      setError('');
      const t = new Date(at).getTime();
      const r = await createClubAction(course.id, t, place);
      if (!r.ok) return setError(r.error);
      setNotice(`Speaking club on ${when(t)} added. Students see it on their study page.`);
      setAt('');
      setPlace('');
    });

  return (
    <main className="admin-main">
      <div className="page admin-page">
        <header className="vhead">
          <div>
            <p className="eyebrow">{course.name}</p>
            <h1>Study together</h1>
          </div>
          <Link className="btn" href={`/${course.id}`}>Open the app</Link>
        </header>
        <CourseBar course={course} courses={courses} admin={admin} />
        {notice && <p className="notice" role="status">{notice}</p>}

        <div className="tiles tiles-6">
          <div className="tile"><p className="tile-l">Signed up for next week</p><p className="tile-v">{view.signups}</p><p className="tile-s">sign-ups close Sunday 18:00</p></div>
          <div className="tile"><p className="tile-l">Groups this week</p><p className="tile-v">{view.thisWeek.groups}</p><p className="tile-s">{view.thisWeek.grouped} of {view.thisWeek.signups} signed up got a group</p></div>
          <div className="tile"><p className="tile-l">Reports</p><p className="tile-v">{view.reports.length}</p><p className="tile-s">from study chats, last 180 days</p></div>
        </div>

        <section className="panel" aria-labelledby="heat-h">
          <div className="panel-h"><h2 id="heat-h">Best times next week</h2><span className="muted">{weekRange(view.week)} · {cityOf(view.timeZone)} time</span></div>
          {view.signups < MIN_SIGNUPS ? (
            <p className="muted small">The heatmap appears once {MIN_SIGNUPS} students have signed up ({view.signups} so far), so nobody’s hours can be told apart.</p>
          ) : best.length ? (
            <p className="small">Most free: {best.map(([s, n]) => `${label(Number(s))} (${n})`).join(' · ')}. Tap an hour to plan a speaking club then.</p>
          ) : (
            <p className="muted small">No hour is shared by 2 or more students yet.</p>
          )}
          <div className="study-grid heat-grid" role="grid" aria-label="How many students are free at each hour next week">
            <span />
            {DAY_NAMES.map((d) => <span key={d.short} className="sg-day">{d.short}</span>)}
            {HOURS.map((h) => (
              <Row key={h} hour={h} heat={view.heat} max={max} onPick={(slot) => setAt(localInput(slotStart(view.week, slot, view.timeZone)))} />
            ))}
          </div>
          <p className="hint">Counts only, and only hours at least 2 students share: who is free stays private. Groups are made on Sunday at 18:00.</p>
        </section>

        <section className="panel" aria-labelledby="clubs-h">
          <div className="panel-h"><h2 id="clubs-h">Speaking clubs</h2><span className="muted">sessions with you, for the whole course</span></div>
          <div className="field-row">
            <label className="field"><span className="label">When</span>
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
            <label className="field"><span className="label">Where (a room, or an https link)</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} placeholder="Room 204" /></label>
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="btn-row"><button className="btn btn-primary" disabled={!at || pending} onClick={addClub} aria-busy={pending}>Add speaking club</button></div>
          {view.clubs.length > 0 && (
            <ul className="club-list">
              {view.clubs.map((c) => (
                <li key={c.id}>
                  <span className="grow"><b>{mounted ? when(c.startsAt) : ''}</b>{c.place && <span className="muted"> · {c.place}</span>}<span className="muted"> · {c.going} coming</span></span>
                  <ConfirmButton className="btn btn-sm btn-danger" confirmLabel="Tap again to delete"
                    onConfirm={() => start(async () => { const r = await deleteClubAction(course.id, c.id); if (!r.ok) setError(r.error); })}>
                    Delete
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="reports-h">
          <div className="panel-h"><h2 id="reports-h">Reports</h2><span className="muted">who reported whom, and why</span></div>
          {!view.reports.length ? <p className="muted">No reports. 🎉</p> : (
            <ul className="report-list">
              {view.reports.map((r) => (
                <li key={r.id}>
                  <span className="muted small">{mounted ? when(r.at) : ''}</span>
                  <span><b>{r.reporter}</b> reported <b>{r.reported}</b>: {REASON_LABEL[r.reason]}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">Messages are never shown, here or anywhere: talk to the students. Reporting also means they’re never grouped together again.</p>
        </section>
        <p className="hint center">Study chats are private to their groups: no page in the app shows them to teachers or admins. They are deleted 14 days after their week.</p>
      </div>
    </main>
  );
}

function Row({ hour, heat, max, onPick }: { hour: number; heat: Record<number, number>; max: number; onPick: (slot: number) => void }) {
  return (
    <>
      <span className="sg-hour">{hour}</span>
      {Array.from({ length: DAYS }, (_, d) => {
        const slot = d * 24 + hour;
        const n = heat[slot] ?? 0;
        return (
          <button key={d} type="button" className="sg-cell heat" style={{ ['--heat' as string]: n / max }} onClick={() => onPick(slot)}
            aria-label={`${DAY_NAMES[d].label} ${hour}:00: ${n} free`}>
            {n || ''}
          </button>
        );
      })}
    </>
  );
}

function weekRange(week: string): string {
  const d = new Date(`${week}T12:00:00Z`);
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}. – ${end.getUTCDate()}.${end.getUTCMonth() + 1}.`;
}
