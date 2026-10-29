'use client';

import { useEffect } from 'react';
import { useLocalState } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { CHEERS, isClassMember, type CheerKind, type ClassMember } from '@/lib/types';
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
  const { tn } = useT();
  return (
    <span className={`streak${days ? '' : ' is-zero'}`} title={tn(days, '{n} day in a row', '{n} days in a row')}>
      <Icon name="flame" />
      {days}
    </span>
  );
}

/** Cheers you received, shown until you tap "Thanks". */
export function CheersBanner() {
  const { cheers } = useStore();
  const { t } = useT();
  if (!cheers.length) return null;
  return (
    <section className="cheers" aria-label={t('Cheers from your classmates')}>
      <ul>
        {cheers.slice(0, 4).map((c) => (
          <li key={c.id}>
            <Avatar id={c.from.id} name={c.from.displayName} size="sm" />
            <span className="grow">
              <b>{c.from.displayName}</b> {t(CHEERS[c.kind])}
            </span>
            <span className="cheer-ic"><Icon name={CHEER_ICON[c.kind]} /></span>
          </li>
        ))}
      </ul>
      {cheers.length > 4 && <p className="hint">{t('and {n} more', { n: cheers.length - 4 })}</p>}
      <button className="btn" onClick={() => store.dismissCheers()}>{t('Thanks!')}</button>
    </section>
  );
}

export function ClassView({ active }: { active: boolean }) {
  const data = useStore();
  const ui = useUI();
  const [metric, setMetric] = useLocalState<Metric>('kk.classMetric', 'active', isMetric);
  const member = isClassMember(data.me);
  const { t } = useT();

  // Refresh whenever the tab is opened, and after switching to another course (another class).
  const courseId = data.course?.id;
  useEffect(() => {
    if (active && data.me) void store.loadClass();
  }, [active, data.me, courseId]);

  const head = (
    <header className="vhead">
      <div>
        <p className="eyebrow">{data.course?.name}</p>
        <h1>{t('Your class')}</h1>
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
            <p>{t('Could not load your class. Check your internet connection.')}</p>
            <button className="btn" onClick={() => store.loadClass()}>{t('Try again')}</button>
          </div>
        ) : (
          <div className="panel loading" aria-busy="true">{t('Finding your classmates…')}</div>
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
      {data.me && !member && (
        <p className="notice" role="status">{t('Your teacher has taken you off the leaderboard. Your study works as usual.')}</p>
      )}

      {me && (
        <section className="me-card" aria-label={t('You')}>
          <div className="me-top">
            <Avatar id={me.id} name={me.displayName} size="lg" />
            <div className="grow">
              <p className="me-name">{me.displayName}</p>
            </div>
            <span className={`me-streak${me.streak ? '' : ' is-zero'}`}>
              <Icon name="flame" />
              <b>{me.streak}</b>
              <span>{t(me.streak === 1 ? 'day' : 'days')}</span>
            </span>
          </div>
          <div className="me-stats">
            <div><b>{me.activeWords}</b><span>{t('active words')}</span></div>
            <div><b>{me.answersToday}</b><span>{t('answers today')}</span></div>
            <div><b>{me.answersWeek}</b><span>{t('this week')}</span></div>
          </div>
          {!me.studiedToday && (
            <div className="me-nudge">
              <span>{me.streak ? t('Study today to keep your {n}-day streak.', { n: me.streak }) : t('Answer one card today to start a streak.')}</span>
              <button className="btn btn-primary" onClick={() => { ui.setTab('study'); ui.startReview(); }}>{t('Study')}</button>
            </div>
          )}
        </section>
      )}

      <section className="panel today-strip" aria-label={t('Studied today')}>
        <div className="stack" aria-hidden="true">
          {studied.slice(0, 6).map((x) => <Avatar key={x.id} id={x.id} name={x.displayName} size="sm" />)}
        </div>
        <p>
          {others === 0
            ? t('You’re the first one here. Share the app with your classmates.')
            : <><b>{t('{a} of {b}', { a: studied.length, b: cls.members.length })}</b> {t('studied today')}</>}
        </p>
      </section>

      <section className="panel" aria-labelledby="board-h">
        <div className="panel-h">
          <h2 id="board-h">{t('Leaderboard')}</h2>
        </div>
        <span className="seg seg-board" role="group" aria-label={t('Rank by')}>
          {METRICS.map((x) => (
            <button key={x.id} className="seg-btn" aria-pressed={metric === x.id} onClick={() => setMetric(x.id)}>{t(x.label)}</button>
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
                    {x.isMe && <span className="you">{t('you')}</span>}
                    {x.role === 'admin' && <span className="teacher">{t('teacher')}</span>}
                  </span>
                  <span className="meta">
                    <Streak days={x.streak} />
                    {x.studiedToday && <span className="today-dot">{t('studied today')}</span>}
                  </span>
                </span>
                <span className="score">
                  <b>{v}</b>
                  <span>{t(m.unit(v))}</span>
                </span>
                {!x.isMe && member && (
                  <button
                    className={`cheer-btn${x.cheeredToday ? ' is-done' : ''}`}
                    disabled={x.cheeredToday}
                    onClick={() => ui.openSheet({ kind: 'cheer', to: x.id })}
                    aria-label={t(x.cheeredToday ? 'You cheered {name} today' : 'Cheer {name}', { name: x.displayName })}
                  >
                    <Icon name={x.cheeredToday ? 'check' : 'star'} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <p className="hint">
          {t('Active words are words you have started learning. A streak counts the days in a row with at least one answer. Only these numbers are shared; your cards stay private.')}
        </p>
      </section>
    </div>
  );
}
