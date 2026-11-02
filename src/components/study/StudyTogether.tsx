'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCourseLang } from '@/lib/client/course';
import { usePoll } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import * as api from '@/lib/client/study';
import { checkMessage, MAX_MESSAGE } from '@/lib/study/text';
import { REASON_LABEL, REPORT_REASONS, type ReportReason, type StudyClub, type StudyGroupView, type StudyMessage, type StudyState } from '@/lib/study/types';
import { cityOf, DAYS, FIRST_HOUR, LAST_HOUR, slotDay, slotHour } from '@/lib/study/week';
import { Avatar, ConfirmButton, Icon } from '../ui';

export const DAY_NAMES = [
  { short: 'Mon', label: 'Monday' },
  { short: 'Tue', label: 'Tuesday' },
  { short: 'Wed', label: 'Wednesday' },
  { short: 'Thu', label: 'Thursday' },
  { short: 'Fri', label: 'Friday' },
  { short: 'Sat', label: 'Saturday' },
  { short: 'Sun', label: 'Sunday' },
];
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);

/** '2026-11-09' → '9.11. – 15.11.' */
function weekRange(week: string): string {
  const d = new Date(`${week}T12:00:00Z`);
  const end = new Date(d);
  end.setUTCDate(d.getUTCDate() + 6);
  const f = (x: Date) => `${x.getUTCDate()}.${x.getUTCMonth() + 1}.`;
  return `${f(d)} – ${f(end)}`;
}

function useSlotLabel() {
  const { t } = useT();
  return (slot: number) => `${t(DAY_NAMES[slotDay(slot)].short)} ${slotHour(slot)}:00`;
}

/**
 * The card at the top of the Class tab: how your study week looks, and the way into the full page.
 * /lets-study-together lands here (as #study) and opens the page.
 */
export function StudyCard({ active, teacher }: { active: boolean; teacher: boolean }) {
  const { t, tn } = useT();
  const slotLabel = useSlotLabel();
  const [state, setState] = useState<StudyState | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === '#study');
  useEffect(() => {
    if (window.location.hash === '#study') history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const load = async () => {
    try {
      setState(await api.fetchStudy());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  usePoll(load, 30_000, active || open);

  const unread = state?.groups.reduce((n, g) => n + g.unread, 0) ?? 0;
  const current = state?.groups.find((g) => g.open);
  const club = state?.clubs[0];
  let line: string;
  if (!state) line = error ? t(error) : t('Loading…');
  else if (!state.eligible) line = teacher ? t('Plan speaking clubs and see the best times for your class.') : t('Study groups are switched off for your profile.');
  else if (current) line = current.slot === null ? t('Your group is ready.') : t('Your group is ready. Suggested time: {time}.', { time: slotLabel(current.slot) });
  else if (state.slots) line = t('You’re in for next week ({range}). Groups are made on Sunday at 18:00.', { range: weekRange(state.week) });
  else line = t('Practise speaking with two classmates next week. Pick the hours you’re free.');

  return (
    <section className="panel study-card" aria-labelledby="study-h">
      <div className="study-card-top">
        <span className="study-ic"><Icon name="chat" /></span>
        <div className="grow">
          <h2 id="study-h">{t('Let’s study together')}</h2>
          <p className="muted">{line}</p>
          {club && <p className="small"><Icon name="calendar" /> {t('Speaking club')}: {new Date(club.startsAt).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        {unread > 0 && <span className="unread" aria-label={tn(unread, '{n} new message', '{n} new messages')}>{unread}</span>}
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => setOpen(true)} disabled={!state}>
          {t(current ? 'Open your group' : state?.slots ? 'Change your hours' : state?.eligible ? 'I want to study' : 'Open')}
        </button>
        {teacher && <Link className="btn" href="/admin/study">{t('Best times')}</Link>}
      </div>
      {open && state && <StudySheet state={state} setState={setState} reload={load} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** The full page: your groups, next week's sign-up, speaking clubs; or one group's chat. */
function StudySheet({ state, setState, reload, onClose }: {
  state: StudyState;
  setState: (s: StudyState) => void;
  reload: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useT();
  const [chat, setChat] = useState<string | null>(null);
  const group = state.groups.find((g) => g.id === chat);

  if (group) {
    return (
      <div className="runner study" role="dialog" aria-modal="true" aria-label={t('Group chat')}>
        <GroupChat key={group.id} group={group} onBack={() => { setChat(null); void reload(); }} onLeft={() => { setChat(null); void reload(); }} />
      </div>
    );
  }
  return (
    <div className="runner study" role="dialog" aria-modal="true" aria-label={t('Let’s study together')}>
      <div className="rv-top">
        <button className="icon-btn" onClick={onClose} aria-label={t('Close')}><Icon name="x" /></button>
        <div className="runner-title"><b>{t('Let’s study together')}</b></div>
        <span />
      </div>
      <div className="runner-body">
        {state.groups.map((g) => <GroupCard key={g.id} group={g} onOpen={() => setChat(g.id)} />)}
        {state.noGroup && (
          <p className="notice" role="status">{t('No group last time: nobody shared your free hours. Pick more hours for next week.')}</p>
        )}
        {state.eligible ? (
          <SignupPanel key={`${state.week}:${state.slots?.join(',') ?? '-'}`} state={state} onSaved={setState} />
        ) : (
          <div className="panel"><p>{t('Study groups are for the students of this course. Teachers plan speaking clubs in the admin pages.')}</p></div>
        )}
        <Clubs clubs={state.clubs} onChange={(clubs) => setState({ ...state, clubs })} />
        <p className="hint study-safety">
          <Icon name="shield" /> {t('Only your group can read your chat, not even teachers. Links, phone numbers and usernames are blocked. Chats are deleted 14 days after their week.')}
        </p>
      </div>
    </div>
  );
}

function GroupCard({ group, onOpen }: { group: StudyGroupView; onOpen: () => void }) {
  const { t, tn } = useT();
  const lang = useCourseLang();
  const slotLabel = useSlotLabel();
  return (
    <section className={`panel group-card${group.open ? '' : ' is-over'}`} aria-label={t('Your group')}>
      <div className="panel-h">
        <h2>{t(group.open ? 'Your group' : 'Last week’s group')} <span className="muted">· {weekRange(group.week)}</span></h2>
        {group.unread > 0 && <span className="unread">{group.unread}</span>}
      </div>
      <ul className="member-list">
        {group.members.map((m) => (
          <li key={m.key} className={m.left ? 'is-left' : ''}>
            <Avatar id={m.key} name={m.name} src={m.avatarUrl} size="sm" />
            <span>{m.name}{m.me && <span className="muted"> ({t('you')})</span>}{m.left && <span className="muted"> · {t('left')}</span>}</span>
          </li>
        ))}
      </ul>
      {group.slot !== null && (
        <p className="study-time"><Icon name="calendar" /> {t('Suggested time')}: <b>{slotLabel(group.slot)}</b>
          {group.slots.length > 1 && <span className="muted"> · {tn(group.slots.length - 1, 'and {n} more shared hour', 'and {n} more shared hours')}</span>}
        </p>
      )}
      <div className="task-card" lang={lang.code}>
        <p className="label">{t('Speaking task')}</p>
        <p>{group.task.prompt}</p>
        <div className="cards-row">{group.task.cards.map((c) => <span key={c} className="word-card">{c}</span>)}</div>
      </div>
      <button className="btn btn-primary" onClick={onOpen}><Icon name="chat" /> {t(group.open ? 'Open the chat' : 'Read the chat')}</button>
    </section>
  );
}

/** Next week's free hours: tap hours (or a whole day or hour row); drag with a mouse. */
function SignupPanel({ state, onSaved }: { state: StudyState; onSaved: (s: StudyState) => void }) {
  const { t, tn } = useT();
  const [picked, setPicked] = useState<Set<number>>(() => new Set(state.slots ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drag = useRef<boolean | null>(null); // while dragging: select (true) or clear (false)
  const pressed = useRef(false); // a mouse press already toggled the cell its click lands on
  const signed = !!state.slots;
  const changed = signed ? [...picked].sort((a, b) => a - b).join() !== state.slots!.join() : picked.size > 0;

  const set = (slots: number[], on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      for (const s of slots) if (on) next.add(s); else next.delete(s);
      return next;
    });
  const toggleAll = (slots: number[]) => set(slots, !slots.every((s) => picked.has(s)));
  const save = async (fn: () => Promise<StudyState>) => {
    setBusy(true);
    setError('');
    try {
      onSaved(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel signup-panel" aria-labelledby="signup-h">
      <div className="panel-h">
        <h2 id="signup-h">{t('Next week')} <span className="muted">· {weekRange(state.week)}</span></h2>
        {signed && <span className="chip-now">{t('signed up')}</span>}
      </div>
      <p className="muted small">
        {t('Tap the hours you’re free. On Sunday at 18:00 you get a group of 3 who are free at the same time, with a chat.')}{' '}
        {t('Times are {city} time.', { city: cityOf(state.timeZone) })}
      </p>
      <div className="study-grid" role="group" aria-label={t('Free hours next week')}
        onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
        <span />
        {DAY_NAMES.map((d, i) => (
          <button key={d.short} type="button" className="sg-day" onClick={() => toggleAll(HOURS.map((h) => i * 24 + h))} aria-label={t('Whole day: {day}', { day: t(d.label) })}>
            {t(d.short)}
          </button>
        ))}
        {HOURS.map((h) => (
          <Row key={h} hour={h} picked={picked} drag={drag} pressed={pressed} set={set} toggleAll={toggleAll} />
        ))}
      </div>
      <p className="muted small">{tn(picked.size, '{n} hour picked', '{n} hours picked')}</p>
      {error && <p className="err" role="alert">{t(error)}</p>}
      <div className="btn-row">
        <button className="btn btn-primary" disabled={busy || !changed || !picked.size} onClick={() => void save(() => api.saveSlots([...picked]))} aria-busy={busy}>
          {t(signed ? 'Save my hours' : 'I want to study')}
        </button>
        {signed && (
          <ConfirmButton className="btn" confirmLabel={t('Tap again: not next week')} onConfirm={() => void save(api.withdraw)}>
            {t('Not next week')}
          </ConfirmButton>
        )}
      </div>
    </section>
  );
}

function Row({ hour, picked, drag, pressed, set, toggleAll }: {
  hour: number;
  picked: Set<number>;
  drag: React.RefObject<boolean | null>;
  pressed: React.RefObject<boolean>;
  set: (slots: number[], on: boolean) => void;
  toggleAll: (slots: number[]) => void;
}) {
  const { t } = useT();
  return (
    <>
      <button type="button" className="sg-hour" onClick={() => toggleAll(Array.from({ length: DAYS }, (_, d) => d * 24 + hour))}
        aria-label={t('Every day at {time}', { time: `${hour}:00` })}>
        {hour}
      </button>
      {Array.from({ length: DAYS }, (_, d) => {
        const slot = d * 24 + hour;
        const on = picked.has(slot);
        return (
          <button key={d} type="button" className="sg-cell" aria-pressed={on} aria-label={`${t(DAY_NAMES[d].label)} ${hour}:00`}
            onPointerDown={(e) => {
              if (e.pointerType !== 'mouse') return; // touch: a tap is a click; the page keeps scrolling
              drag.current = !on;
              pressed.current = true;
              set([slot], !on);
            }}
            onPointerEnter={() => drag.current !== null && set([slot], drag.current)}
            onClick={() => {
              if (pressed.current) pressed.current = false; // done on pointerdown
              else set([slot], !on); // touch and keyboard
            }}
          />
        );
      })}
    </>
  );
}

function Clubs({ clubs, onChange }: { clubs: StudyClub[]; onChange: (c: StudyClub[]) => void }) {
  const { t, tn } = useT();
  const [error, setError] = useState('');
  if (!clubs.length) return null;
  return (
    <section className="panel" aria-labelledby="clubs-h">
      <div className="panel-h"><h2 id="clubs-h">{t('Speaking clubs')}</h2><span className="muted">{t('with your teacher')}</span></div>
      <ul className="club-list">
        {clubs.map((c) => (
          <li key={c.id}>
            <span className="grow">
              <b>{new Date(c.startsAt).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</b>
              {c.place && (
                <span className="muted small"> · {/^https:\/\//.test(c.place) ? <a href={c.place} target="_blank" rel="noopener noreferrer">{t('Online link')}</a> : c.place}</span>
              )}
              <span className="muted small"> · {tn(c.going, '{n} coming', '{n} coming')}</span>
            </span>
            <button className={`btn btn-sm${c.me ? ' btn-primary' : ''}`} aria-pressed={c.me}
              onClick={() => api.rsvp(c.id, !c.me).then(onChange, (e: Error) => setError(e.message))}>
              {t(c.me ? 'I’ll come ✓' : 'I’ll come')}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="err">{t(error)}</p>}
    </section>
  );
}

/** One group's chat: plain text, refreshed every 3 seconds while open; members, block, report, leave. */
function GroupChat({ group, onBack, onLeft }: { group: StudyGroupView; onBack: () => void; onLeft: () => void }) {
  const { t } = useT();
  const [messages, setMessages] = useState<StudyMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const last = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const byKey = new Map(group.members.map((m) => [m.key, m]));

  const add = (more: StudyMessage[]) =>
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...more.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
    });
  usePoll(async () => {
    try {
      const more = await api.fetchMessages(group.id, last.current);
      if (more.length) {
        last.current = more[more.length - 1].id;
        add(more);
      }
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, 3000, true);

  // Keep the newest message in view
  const count = messages.length;
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  const send = async () => {
    const check = checkMessage(text);
    if (!check.ok) return setError(check.error);
    setSending(true);
    setError('');
    const sent = text;
    try {
      add([await api.postMessage(group.id, check.body)]);
      setText((now) => (now === sent ? '' : now)); // keep anything typed while it was sending
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  const others = group.members.filter((m) => !m.me);

  return (
    <>
      <div className="rv-top">
        <button className="icon-btn" onClick={onBack} aria-label={t('Back')}><Icon name="back" /></button>
        <div className="runner-title">
          <b>{others.filter((m) => !m.left).map((m) => m.name).join(', ') || t('Your group')}</b>
          <span className="muted small">{weekRange(group.week)}</span>
        </div>
        <span />
      </div>
      <div className="chat-list" ref={list} aria-live="polite">
        {!loaded ? <p className="muted center">{t('Loading…')}</p> : !messages.length ? (
          <p className="muted center chat-empty">{t('Say hello and agree on a time. The speaking task is on the group card.')}</p>
        ) : messages.map((m, i) => {
          const who = byKey.get(m.key);
          const first = i === 0 || messages[i - 1].key !== m.key;
          return (
            <div key={m.id} className={`msg${m.mine ? ' is-mine' : ''}`}>
              {first && !m.mine && <span className="msg-who">{who?.name ?? t('Former member')}</span>}
              <p className="msg-body">{m.body}</p>
              <span className="msg-time">{new Date(m.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          );
        })}
      </div>
      {group.open ? (
        <div className="composer">
          {error && <p className="err" role="alert">{t(error)}</p>}
          <div className="composer-row">
            <textarea value={text} onChange={(e) => { setText(e.target.value); setError(''); }} rows={2} maxLength={MAX_MESSAGE} aria-label={t('Message')}
              placeholder={t('Write a message…')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }} />
            <button className="btn btn-primary" onClick={() => void send()} disabled={sending || !text.trim()} aria-label={t('Send')}><Icon name="send" /></button>
          </div>
        </div>
      ) : (
        <p className="notice composer">{t('This week is over, so the chat is read-only. It is deleted on {date}.', { date: new Date(group.deleteAt).toLocaleDateString() })}</p>
      )}
      <details className="chat-members">
        <summary>{t('Members and safety')}</summary>
        {notice && <p className="notice" role="status">{notice}</p>}
        <ul className="member-list">
          {others.map((m) => <MemberRow key={m.key} groupId={group.id} member={m} onDone={setNotice} />)}
        </ul>
        <ConfirmButton className="btn btn-danger" confirmLabel={t('Tap again to leave the group')}
          onConfirm={() => api.leave(group.id).then(onLeft, (e: Error) => setError(e.message))}>
          {t('Leave the group')}
        </ConfirmButton>
      </details>
    </>
  );
}

function MemberRow({ groupId, member, onDone }: { groupId: string; member: StudyGroupView['members'][number]; onDone: (s: string) => void }) {
  const { t } = useT();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('rude');
  const fail = (e: Error) => onDone(t(e.message));
  return (
    <li className="member-row">
      <Avatar id={member.key} name={member.name} src={member.avatarUrl} size="sm" />
      <span className="grow">{member.name}{member.left && <span className="muted"> · {t('left')}</span>}</span>
      {!reporting ? (
        <>
          <ConfirmButton className="btn btn-sm" confirmLabel={t('Tap again to block')}
            onConfirm={() => api.block(groupId, member.key).then(() => onDone(t('{name} is blocked: you won’t be in a group together again.', { name: member.name })), fail)}>
            {t('Block')}
          </ConfirmButton>
          <button className="btn btn-sm" onClick={() => setReporting(true)}><Icon name="flag" /> {t('Report')}</button>
        </>
      ) : (
        <span className="report-form">
          <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} aria-label={t('Why?')}>
            {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(REASON_LABEL[r])}</option>)}
          </select>
          <button className="btn btn-sm btn-danger" onClick={() => api.report(groupId, member.key, reason).then(() => {
            setReporting(false);
            onDone(t('Thank you. Your teacher sees who you reported and why, never your messages. You won’t be in a group together again.'));
          }, fail)}>{t('Send report')}</button>
          <button className="btn btn-sm btn-quiet" onClick={() => setReporting(false)}>{t('Cancel')}</button>
        </span>
      )}
    </li>
  );
}
