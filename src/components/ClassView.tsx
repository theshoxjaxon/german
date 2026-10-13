'use client';

import { useEffect } from 'react';
import { useLocalState } from '@/lib/client/hooks';
import { store, useStore } from '@/lib/client/store';
import { plural } from '@/lib/time';
import { CHEERS, type CheerKind, type ClassMember } from '@/lib/types';
import { Avatar, Icon, type IconName } from './ui';
import { useUI } from './ui-context';

type Metric = 'active' | 'week' | 'streak';
const METRICS: { id: Metric; label: string; value: (m: ClassMember) => number; unit: (n: number) => string }[] = [
  { id: 'active', label: 'Active words', value: (m) => m.activeWords, unit: (n) => (n === 1 ? 'word' : 'words') },
  { id: 'week', label: 'This week', value: (m) => m.answersWeek, unit: (n) => (n === 1 ? 'answer' : 'answers') },
  { id: 'streak', label: 'Streak', value: (m) => m.streak, unit: (n) => (n === 1 ? 'day' : 'days') },
];
const isMetric = (v: unknown) => v === 'active' || v === 'week' || v === 'streak';
export const CHEER_ICON: Record<CheerKind, IconName> = { 'keep-going': 'flame', 'great-streak': 'star', 'study-together': 'book' };

export function Streak({ days }: { days: number }) {
  return (
    <span className={`streak${days ? '' : ' is-zero'}`} title={`${plural(days, 'day', 'days')} in a row`}>
      <Icon name="flame" />
      {days}
    </span>
  );
}

/** Cheers you received, shown until you tap "Thanks". */
export function CheersBanner() {
  const { cheers } = useStore();
  if (!cheers.length) return null;
  return (
    <section className="cheers" aria-label="Cheers from your classmates">
      <ul>
        {cheers.slice(0, 4).map((c) => (
          <li key={c.id}>
            <Avatar id={c.from.id} name={c.from.displayName} size="sm" />
            <span className="grow">
              <b>{c.from.displayName}</b> {CHEERS[c.kind]}
            </span>
            <span className="cheer-ic"><Icon name={CHEER_ICON[c.kind]} /></span>
          </li>
        ))}
      </ul>
      {cheers.length > 4 && <p className="hint">and {cheers.length - 4} more</p>}
      <button className="btn" onClick={() => store.dismissCheers()}>Thanks!</button>
    </section>
  );
}

export function ClassView({ active }: { active: boolean }) {
  const data = useStore();
  const ui = useUI();
  const [metric, setMetric] = useLocalState<Metric>('kk.classMetric', 'active', isMetric);

  // Refresh whenever the tab is opened.
  useEffect(() => {
    if (active) void store.loadClass();
  }, [active]);

  const head = (
    <header className="vhead">
      <div>
        <p className="eyebrow" lang="de">Lernzentrum</p>
        <h1>Your class</h1>
      </div>
    </header>
  );
  const cls = data.classData;
  if (!cls) {
    return (
      <div className="page">
        {head}
        {data.classStatus === 'error' ? (
          <div className="panel error-panel" role="alert">
            <p>Could not load your class. Check your internet connection.</p>
            <button className="btn" onClick={() => store.loadClass()}>Try again</button>
          </div>
        ) : (
          <div className="panel loading" aria-busy="true">Finding your classmates…</div>
        )}
      </div>
    );
  }

  const me = cls.members.find((m) => m.isMe);
  const m = METRICS.find((x) => x.id === metric)!;
  const ranked = [...cls.members].sort((a, b) => m.value(b) - m.value(a) || a.displayName.localeCompare(b.displayName));
  const studied = cls.members.filter((x) => x.studiedToday);
  const others = cls.members.length - 1;

  return (
    <div className="page">
      {head}
      <CheersBanner />

      {me && (
        <section className="me-card" aria-label="You">
          <div className="me-top">
            <Avatar id={me.id} name={me.displayName} size="lg" />
            <div className="grow">
              <p className="me-name">{me.displayName}</p>
              <p className="muted small">@{me.username}</p>
            </div>
            <span className={`me-streak${me.streak ? '' : ' is-zero'}`}>
              <Icon name="flame" />
              <b>{me.streak}</b>
              <span>{me.streak === 1 ? 'day' : 'days'}</span>
            </span>
          </div>
          <div className="me-stats">
            <div><b>{me.activeWords}</b><span>active words</span></div>
            <div><b>{me.answersToday}</b><span>answers today</span></div>
            <div><b>{me.answersWeek}</b><span>this week</span></div>
          </div>
          {!me.studiedToday && (
            <div className="me-nudge">
              <span>{me.streak ? `Study today to keep your ${me.streak}-day streak.` : 'Answer one card today to start a streak.'}</span>
              <button className="btn btn-primary" onClick={() => { ui.setTab('study'); ui.startReview(); }}>Study</button>
            </div>
          )}
        </section>
      )}

      <section className="panel today-strip" aria-label="Studied today">
        <div className="stack" aria-hidden="true">
          {studied.slice(0, 6).map((x) => <Avatar key={x.id} id={x.id} name={x.displayName} size="sm" />)}
        </div>
        <p>
          {others === 0
            ? 'You’re the first one here. Share the join code with your classmates.'
            : <><b>{studied.length} of {cls.members.length}</b> studied today</>}
        </p>
      </section>

      <section className="panel" aria-labelledby="board-h">
        <div className="panel-h">
          <h2 id="board-h">Leaderboard</h2>
        </div>
        <span className="seg seg-board" role="group" aria-label="Rank by">
          {METRICS.map((x) => (
            <button key={x.id} className="seg-btn" aria-pressed={metric === x.id} onClick={() => setMetric(x.id)}>{x.label}</button>
          ))}
        </span>
        <ol className="board">
          {ranked.map((x, i) => {
            const v = m.value(x);
            return (
              <li key={x.id} className={x.isMe ? 'is-me' : undefined}>
                <span className="rank">{i + 1}</span>
                <Avatar id={x.id} name={x.displayName} />
                <span className="who">
                  <span className="name">
                    <span className="nm">{x.displayName}</span>
                    {x.isMe && <span className="you">you</span>}
                    {x.role === 'admin' && <span className="teacher">teacher</span>}
                  </span>
                  <span className="meta">
                    <Streak days={x.streak} />
                    {x.studiedToday && <span className="today-dot">studied today</span>}
                  </span>
                </span>
                <span className="score">
                  <b>{v}</b>
                  <span>{m.unit(v)}</span>
                </span>
                {!x.isMe && (
                  <button
                    className={`cheer-btn${x.cheeredToday ? ' is-done' : ''}`}
                    disabled={x.cheeredToday}
                    onClick={() => ui.openSheet({ kind: 'cheer', to: x.id })}
                    aria-label={x.cheeredToday ? `You cheered ${x.displayName} today` : `Cheer ${x.displayName}`}
                  >
                    <Icon name={x.cheeredToday ? 'check' : 'star'} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <p className="hint">
          Active words are words you have started learning. A streak counts the days in a row with at least one answer. Only these numbers are shared; your cards stay private.
        </p>
      </section>
    </div>
  );
}
