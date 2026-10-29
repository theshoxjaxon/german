'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  deleteUserAction, resetPasswordAction, setClassAction, setClassLessonAction, setRoleAction, setTeacherAction, updateCourseAction,
} from '@/app/admin/actions';
import { langOf, type Course } from '@/lib/courses';
import { useClientValue, useNow } from '@/lib/client/hooks';
import type { AdminStats } from '@/lib/server/repo';
import { dayLabelLong as dayLong, dayLabelShortDe as dayLabel, dayLabelWithYear } from '@/lib/stats';
import { DAY, plural } from '@/lib/time';
import { BottomSheet } from '../BottomSheet';
import { Streak } from '../ClassView';
import { Avatar, ConfirmButton, Icon } from '../ui';
import { ColumnChart } from './charts';
import { CourseBar } from './CourseBar';

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

/** Columns for the last 30 days, with a date under every 7th. Tap a day to read its numbers. */
function DayChart({ days, ...chart }: Omit<Parameters<typeof ColumnChart>[0], 'labels' | 'className'> & { days: string[] }) {
  const last = days.length - 1;
  return <ColumnChart className="cols-30" labels={days.map((d, i) => (i % 7 === last % 7 ? dayLabel(d) : ''))} {...chart} />;
}

/**
 * /admin for one course. `admin`: the person runs the whole app (sees email addresses, resets
 * passwords, makes teachers); a course's teachers see names and run their course's class.
 */
export function AdminDashboard({ stats, meId, admin, course, courses }: {
  stats: AdminStats; meId: string; admin: boolean; course: Course; courses: Course[];
}) {
  const now = useNow();
  const [managing, setManaging] = useState<Person | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState('');
  const inviteLink = useClientValue(() => `${window.location.origin}/c/${course.id}`, `/c/${course.id}`);
  const t = stats.totals;

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

  return (
    <main className="admin-main">
      <div className="page admin-page">
        <header className="vhead">
          <div>
            <p className="eyebrow">{course.name} · {dayLong(stats.today)}</p>
            <h1>Dashboard</h1>
          </div>
          <Link className="btn" href="/">Open the app</Link>
        </header>
        <CourseBar course={course} courses={courses} admin={admin} />
        {notice && <p className="notice" role="status">{notice}</p>}

        <div className="tiles tiles-6">
          <div className="tile"><p className="tile-l">Members</p><p className="tile-v">{t.profiles}</p><p className="tile-s">{plural(t.admins, 'teacher', 'teachers')} included</p></div>
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

        <ClassLessonPanel courseId={course.id} current={stats.classLesson} decks={stats.decks} onDone={setNotice} />

        <section className="panel join-panel" aria-labelledby="invite-h">
          <div className="panel-h"><h2 id="invite-h">Invite students</h2><span className="muted">{langOf(course).name} course</span></div>
          <p className="invite-link">{inviteLink}</p>
          <div className="btn-row">
            <button className="btn" onClick={() => copy(inviteLink, 'Invite link copied.')}><Icon name="copy" /> Copy link</button>
          </div>
          <p className="hint">
            This link opens the app in {course.name}. Whoever signs up from it joins this course’s leaderboard; no code needed.
            People who already have a profile join it too and keep their progress in other courses. Take someone off the leaderboard under Manage.
          </p>
        </section>

        <CoursePanel key={course.id} course={course} onDone={setNotice} />

        <section className="panel people-panel" aria-labelledby="people-h">
          <div className="panel-h"><h2 id="people-h">Members</h2><span className="muted">sorted by last active</span></div>
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
                        <Avatar id={p.id} name={p.displayName} src={p.avatarUrl} size="sm" />
                        <span className="who">
                          <span className="name">
                            <span className="nm">{p.displayName}</span>
                            {p.role === 'admin' ? <span className="teacher">admin</span> : p.teacher && <span className="teacher">teacher</span>}
                            {!p.teacher && !p.inClass && <span className="teacher self">off the board</span>}
                          </span>
                          {admin && <span className="meta">{p.email || 'no email (old profile)'}</span>}
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

      {managing && (
        <ManageSheet key={managing.id} person={managing} courseId={course.id} admin={admin} isMe={managing.id === meId} closing={closing} onClose={close} />
      )}
    </main>
  );
}

/** Which lesson the class is on. "All decks" brings in new words from it first, then the lessons before it. */
function ClassLessonPanel({ courseId, current, decks, onDone }: {
  courseId: string; current: string | null; decks: AdminStats['decks']; onDone: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const change = (deck: string) =>
    startTransition(async () => {
      const r = await setClassLessonAction(courseId, deck);
      onDone(r.ok ? (deck ? `The class is now on ${deck}.` : 'Class lesson cleared: new words come in book order.') : r.error);
    });
  return (
    <section className="panel" aria-labelledby="lesson-h">
      <div className="panel-h"><h2 id="lesson-h">Class lesson</h2><span className="muted">where the class is now</span></div>
      <div className="field">
        <label htmlFor="class-lesson">The class is on</label>
        <select id="class-lesson" value={current ?? ''} disabled={pending} onChange={(e) => change(e.target.value)}>
          <option value="">Not set (book order)</option>
          {decks.map((d) => <option key={d.deck} value={d.deck}>{d.deck} · {plural(d.words, 'word', 'words')}</option>)}
        </select>
      </div>
      <p className="hint">
        Students studying “All decks” get new words from this lesson first, then the lessons before it, newest first.
        Later lessons wait until you move on; anyone can still pick a deck to study it early. Words already started keep their reviews.
      </p>
    </section>
  );
}

/** The course's name and the note students see next to its decks (e.g. "More words coming soon"). */
function CoursePanel({ course, onDone }: { course: Course; onDone: (message: string) => void }) {
  const [pending, startTransition] = useTransition();
  const save = (form: FormData) =>
    startTransition(async () => {
      const r = await updateCourseAction(course.id, String(form.get('name') ?? ''), String(form.get('note') ?? ''));
      onDone(r.ok ? 'Course saved.' : r.error);
    });
  return (
    <section className="panel" aria-labelledby="course-h">
      <div className="panel-h"><h2 id="course-h">Course</h2><span className="muted">{plural(course.words, 'lesson word', 'lesson words')}</span></div>
      <form className="form" action={save}>
        <div className="field">
          <label htmlFor="course-name">Name</label>
          <input id="course-name" name="name" defaultValue={course.name} required maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="course-note">Note for students</label>
          <input id="course-note" name="note" defaultValue={course.note} maxLength={80} placeholder="More words coming soon" />
          <p className="hint">Shown next to the decks and in the course list. Leave it empty for none.</p>
        </div>
        <div className="btn-row"><button className="btn" disabled={pending} aria-busy={pending}>Save</button></div>
      </form>
    </section>
  );
}

function ManageSheet({ person, courseId, admin, isMe, closing, onClose }: {
  person: Person; courseId: string; admin: boolean; isMe: boolean; closing: boolean; onClose: () => void;
}) {
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
        <Avatar id={person.id} name={person.displayName} src={person.avatarUrl} size="lg" />
        <div>
          <p className="me-name">{person.displayName}</p>
          {admin && <p className="muted small">{person.email || 'No email: an old profile that can’t log in any more'}</p>}
          {admin && <p className="muted small">{[person.hasGoogle && 'Google', person.hasPassword && 'password'].filter(Boolean).join(' + ') || 'no way to log in'}</p>}
          <span className={`role-pill role-${person.teacher ? 'admin' : 'student'}`}>
            {person.role === 'admin' ? 'Admin · teacher' : person.teacher ? 'Teacher of this course'
              : person.inClass ? 'Student · on the leaderboard' : 'Student · off the leaderboard'}
          </span>
        </div>
      </div>
      <dl className="facts">
        <div><dt>Active words</dt><dd>{person.activeWords}</dd></div>
        <div><dt>Mature</dt><dd>{person.matureWords}</dd></div>
        <div><dt>Streak</dt><dd>{person.streak}</dd></div>
        <div><dt>Answers 7d</dt><dd>{person.answersWeek}</dd></div>
      </dl>

      {!admin ? null : password ? (
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
          {!person.teacher && (
            <button className="btn" disabled={pending} onClick={() => run(() => setClassAction(courseId, person.id, !person.inClass), onClose)}>
              <Icon name="people" /> {person.inClass ? 'Take off the leaderboard' : 'Put back on the leaderboard'}
            </button>
          )}
          {admin && person.role !== 'admin' && (
            <button className="btn" disabled={pending} onClick={() => run(() => setTeacherAction(courseId, person.id, !person.teacher), onClose)}>
              <Icon name="book" /> {person.teacher ? 'Remove as this course’s teacher' : 'Make teacher of this course'}
            </button>
          )}
          {admin && (
            <>
              <button className="btn" disabled={pending}
                onClick={() => run(() => setRoleAction(person.id, person.role === 'admin' ? 'student' : 'admin'), onClose)}>
                <Icon name="shield" /> {person.role === 'admin' ? 'Remove admin rights' : 'Make admin (runs every course)'}
              </button>
              <ConfirmButton className="btn btn-danger" confirmLabel={`Tap again to delete ${person.displayName}`}
                onConfirm={() => run(() => deleteUserAction(person.id), onClose)}>
                Delete profile and progress
              </ConfirmButton>
            </>
          )}
        </>
      )}
      {!admin && <p className="hint">A course’s teacher edits its lesson words in the app and runs its leaderboard here. Passwords and roles are for the admin.</p>}
      {isMe && <p className="hint">This is you. Another admin can change your role.</p>}
      {message && <p className="err" role="alert">{message}</p>}
    </BottomSheet>
  );
}
