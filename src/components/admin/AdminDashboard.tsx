'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteUserAction, newJoinCodeAction, resetPasswordAction, setRoleAction } from '@/app/admin/actions';
import { useNow } from '@/lib/client/hooks';
import type { AdminStats } from '@/lib/server/repo';
import { dayLabelLong as dayLong, dayLabelShortDe as dayLabel, dayLabelWithYear } from '@/lib/stats';
import { DAY, plural } from '@/lib/time';
import { BottomSheet } from '../BottomSheet';
import { Streak } from '../ClassView';
import { Avatar, ConfirmButton, Icon } from '../ui';

type Person = AdminStats['people'][number];


function lastActive(t: number | null, now: number): string {
  if (!t) return 'Never';
  const mins = Math.round((now - t) / 60_000);
  if (mins < 5) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  const days = Math.round((now - t) / DAY);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/** Columns for the last 30 days. Tap a day to read its numbers. */
function DayChart({ days, series, legend, describe }: {
  days: string[];
  series: { values: number[]; className: string }[]; // bottom to top
  legend?: { label: string; className: string }[];
  describe: (i: number) => string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const totals = days.map((_, i) => series.reduce((n, s) => n + s.values[i], 0));
  const max = Math.max(1, ...totals);
  const peak = totals.indexOf(Math.max(...totals));
  const last = days.length - 1;
  return (
    <>
      <p className="chart-read" aria-live="polite">{describe(sel ?? last)}</p>
      <div className="cols cols-30">
        {days.map((d, i) => (
          <button key={d} className={`col${i === last ? ' is-today' : ''}${sel === i ? ' is-sel' : ''}`} onClick={() => setSel(i)} aria-label={describe(i)}>
            <span className="col-val">{totals[i] > 0 && (i === peak || i === last) ? totals[i] : ''}</span>
            <span className="col-plot">
              <span className="col-stack" style={{ height: `${((totals[i] / max) * 100).toFixed(1)}%` }}>
                {[...series].reverse().map((s, k) => (s.values[i] > 0 ? <span key={k} className={s.className} style={{ flex: s.values[i] }} /> : null))}
              </span>
            </span>
            <span className="col-x">{i % 7 === last % 7 ? dayLabel(d) : ''}</span>
          </button>
        ))}
      </div>
      {legend && (
        <div className="legend">
          {legend.map((l) => <span key={l.label}><i className={l.className} />{l.label}</span>)}
        </div>
      )}
    </>
  );
}

export function AdminDashboard({ stats, meId }: { stats: AdminStats; meId: string }) {
  const now = useNow();
  const [managing, setManaging] = useState<Person | null>(null);
  const [closing, setClosing] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  const t = stats.totals;
  const joinCode = code ?? stats.joinCode;

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setManaging(null);
      setClosing(false);
    }, 200);
  };
  const copy = (text: string, done: string) => {
    navigator.clipboard?.writeText(text).then(() => setNotice(done), () => setNotice('Select the text and copy it.'));
  };
  const newCode = () =>
    startTransition(async () => {
      const r = await newJoinCodeAction();
      if (r.ok && r.code) {
        setCode(r.code);
        setNotice('New join code ready. The old one no longer works.');
      } else if (!r.ok) setNotice(r.error);
    });

  return (
    <main className="admin-main">
      <div className="page admin-page">
        <header className="vhead">
          <div>
            <p className="eyebrow" lang="de">Lernzentrum · {dayLong(stats.today)}</p>
            <h1>Dashboard</h1>
          </div>
          <Link className="btn" href="/">Open the app</Link>
        </header>
        {notice && <p className="notice" role="status">{notice}</p>}

        <div className="tiles tiles-6">
          <div className="tile"><p className="tile-l">Profiles created</p><p className="tile-v">{t.profiles}</p><p className="tile-s">{plural(t.admins, 'admin', 'admins')} included</p></div>
          <div className="tile"><p className="tile-l">New this week</p><p className="tile-v">{t.newThisWeek}</p><p className="tile-s">last 7 days</p></div>
          <div className="tile"><p className="tile-l">Studied today</p><p className="tile-v">{t.studiedToday}</p><p className="tile-s">answered 1+ card · {plural(t.answersToday, 'answer', 'answers')}</p></div>
          <div className="tile"><p className="tile-l">Opened today</p><p className="tile-v">{t.openedToday}</p><p className="tile-s">visited the app</p></div>
          <div className="tile"><p className="tile-l">Active this week</p><p className="tile-v">{t.activeWeek}</p><p className="tile-s">of {t.profiles} studied in 7 days</p></div>
          <div className="tile"><p className="tile-l">Active this month</p><p className="tile-v">{t.activeMonth}</p><p className="tile-s">studied in 30 days</p></div>
        </div>

        <section className="panel" aria-labelledby="dau-h">
          <div className="panel-h"><h2 id="dau-h">Daily active students</h2><span className="muted">last 30 days</span></div>
          <DayChart
            days={stats.days}
            series={[
              { values: stats.studiedByDay, className: 'seg-ok' },
              { values: stats.openedOnlyByDay, className: 'seg-open' },
            ]}
            legend={[{ label: 'Studied', className: 'seg-ok' }, { label: 'Opened only', className: 'seg-open' }]}
            describe={(i) => `${dayLong(stats.days[i])}: ${stats.studiedByDay[i]} studied, ${stats.openedOnlyByDay[i]} only opened the app`}
          />
        </section>

        <section className="panel" aria-labelledby="new-h">
          <div className="panel-h"><h2 id="new-h">New profiles</h2><span className="muted">last 30 days</span></div>
          <DayChart
            days={stats.days}
            series={[{ values: stats.signupsByDay, className: 'seg-new' }]}
            describe={(i) => `${dayLong(stats.days[i])}: ${plural(stats.signupsByDay[i], 'new profile', 'new profiles')}`}
          />
        </section>

        <section className="panel join-panel" aria-labelledby="code-h">
          <div className="panel-h"><h2 id="code-h">Join code</h2><span className="muted">students need it to sign up</span></div>
          <p className="join-code" aria-label={`Join code ${joinCode.split('').join(' ')}`}>{joinCode}</p>
          <div className="btn-row">
            <button className="btn" onClick={() => copy(joinCode, 'Join code copied.')}><Icon name="copy" /> Copy code</button>
            <ConfirmButton className="btn" confirmLabel="Tap again: old code stops working" onConfirm={newCode}>
              {pending ? 'Creating…' : 'New code'}
            </ConfirmButton>
          </div>
          <p className="hint">Share it in class or your group chat. Students sign up at /signup. Make a new code if it leaks.</p>
        </section>

        <section className="panel people-panel" aria-labelledby="people-h">
          <div className="panel-h"><h2 id="people-h">Students</h2><span className="muted">sorted by last active</span></div>
          <div className="people-scroll">
            <table className="tbl people">
              <thead>
                <tr>
                  <th scope="col" className="c-term th-plain">Name</th>
                  <th scope="col" className="th-plain">Today</th>
                  <th scope="col" className="th-plain">Streak</th>
                  <th scope="col" className="th-plain num">Active words</th>
                  <th scope="col" className="th-plain num">Answers, 7 days</th>
                  <th scope="col" className="th-plain">Last active</th>
                  <th scope="col" className="th-plain">Joined</th>
                  <th scope="col" className="th-plain"><span className="sr-only">Manage</span></th>
                </tr>
              </thead>
              <tbody>
                {stats.people.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="c-term">
                      <span className="term-cell">
                        <Avatar id={p.id} name={p.displayName} size="sm" />
                        <span className="who">
                          <span className="name"><span className="nm">{p.displayName}</span>{p.role === 'admin' && <span className="teacher">admin</span>}</span>
                          <span className="meta">@{p.username}</span>
                        </span>
                      </span>
                    </th>
                    <td>{p.studiedToday ? <span className="today-dot">studied</span> : <span className="muted">–</span>}</td>
                    <td><Streak days={p.streak} /></td>
                    <td className="num">{p.activeWords}</td>
                    <td className="num">{p.answersWeek}</td>
                    <td>{now ? lastActive(p.lastSeenAt, now) : ''}</td>
                    <td>{dayLabelWithYear(p.joinedDay)}</td>
                    <td><button className="btn btn-sm" onClick={() => setManaging(p)}>Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <p className="hint center">Days run in the {stats.timeZone} time zone. “Studied” means answered at least one card.</p>
      </div>

      {managing && <ManageSheet key={managing.id} person={managing} isMe={managing.id === meId} closing={closing} onClose={close} />}
    </main>
  );
}

function ManageSheet({ person, isMe, closing, onClose }: { person: Person; isMe: boolean; closing: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; password?: string }>, after?: (r: { password?: string }) => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMessage(r.error ?? 'Something went wrong.');
      else after?.(r);
    });

  return (
    <BottomSheet title={person.displayName} onClose={onClose} closing={closing}>
      <div className="profile-head">
        <Avatar id={person.id} name={person.displayName} size="lg" />
        <div>
          <p className="me-name">{person.displayName}</p>
          <p className="muted small">@{person.username}</p>
          <span className={`role-pill role-${person.role}`}>{person.role === 'admin' ? 'Admin · teacher' : 'Student'}</span>
        </div>
      </div>
      <dl className="facts">
        <div><dt>Active words</dt><dd>{person.activeWords}</dd></div>
        <div><dt>Mature</dt><dd>{person.matureWords}</dd></div>
        <div><dt>Streak</dt><dd>{person.streak}</dd></div>
        <div><dt>Answers 7d</dt><dd>{person.answersWeek}</dd></div>
      </dl>

      {password ? (
        <div className="callout callout-ok">
          <div>
            <p>New password for {person.displayName}:</p>
            <p className="temp-password">{password}</p>
            <p className="hint">Give it to them in person. They can change it under Your profile → Change password. They were signed out on all devices.</p>
          </div>
        </div>
      ) : (
        <button className="btn" disabled={pending} onClick={() => run(() => resetPasswordAction(person.id), (r) => setPassword(r.password ?? ''))}>
          <Icon name="key" /> Reset password
        </button>
      )}
      {!isMe && (
        <>
          <button className="btn" disabled={pending}
            onClick={() => run(() => setRoleAction(person.id, person.role === 'admin' ? 'student' : 'admin'), onClose)}>
            <Icon name="shield" /> {person.role === 'admin' ? 'Remove admin rights' : 'Make admin (teacher)'}
          </button>
          <ConfirmButton className="btn btn-danger" confirmLabel={`Tap again to delete ${person.displayName}`}
            onConfirm={() => run(() => deleteUserAction(person.id), onClose)}>
            Delete profile and progress
          </ConfirmButton>
        </>
      )}
      {isMe && <p className="hint">This is you. Another admin can change your role.</p>}
      {message && <p className="err" role="alert">{message}</p>}
    </BottomSheet>
  );
}
