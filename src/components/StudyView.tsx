'use client';

import { answersToday, shownStreak } from '@/lib/goal';
import { useNow } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { buildQueue, currentDeck, deckCounts, dueForecast, LEECH_AT, lapsesOf, nextDueSummary, sortedWords } from '@/lib/queue';
import { dayIndex, dayLong, studyDayTitle, weekday } from '@/lib/time';
import { EMPTY_FILTERS } from '@/lib/words-view';
import { CheersBanner } from './ClassView';
import { GuestImportBanner, GuestNote } from './GuestViews';
import { EmptyBox, Icon, LoadError, SyncNote } from './ui';
import { useUI } from './ui-context';

/** The habit at a glance: today's answers against the daily goal, and the streak. */
function TodayGoal({ done, goal, streak, guest }: { done: number; goal: number; streak: number; guest: boolean }) {
  const { t, tn } = useT();
  const R = 21;
  const C = 2 * Math.PI * R;
  const reached = goal > 0 && done >= goal;
  return (
    <section className={`goal${reached ? ' is-reached' : ''}`} aria-label={t('Daily goal and streak')}>
      {goal > 0 && (
        <svg className="ring" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r={R} className="ring-bg" />
          <circle cx="26" cy="26" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, done / goal))} transform="rotate(-90 26 26)" />
          {reached && <path d="m18.5 26.5 5 5 10-10.5" className="ring-check" />}
        </svg>
      )}
      <div className="goal-text">
        {goal <= 0 ? (
          <><b>{tn(done, '{n} answer today', '{n} answers today')}</b><span>{t('Set a daily goal in study settings')}</span></>
        ) : reached ? (
          <><b>{t('Daily goal reached!')}</b><span>{tn(done, '{n} answer today. See you tomorrow.', '{n} answers today. See you tomorrow.')}</span></>
        ) : (
          <><b>{t('{done} of {goal} answers', { done, goal })}</b><span>{t('{n} more for today’s goal', { n: goal - done })}</span></>
        )}
      </div>
      <span className={`streak-big${streak ? '' : ' is-zero'}`} title={t(guest ? 'Days in a row, on this device' : 'Days in a row')}>
        <Icon name="flame" />
        <b>{streak}</b>
        <span>{t(streak === 1 ? 'day' : 'days')}</span>
      </span>
    </section>
  );
}

export function StudyView() {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const { t, tn, span } = useT();
  const ready = data.status === 'ready' && now > 0;

  const head = (
    <header className="vhead">
      <div>
        <p className="eyebrow" lang="de">{ready ? studyDayTitle(now) : ' '}</p>
        <h1 lang="de">{data.me ? `Hallo, ${data.me.displayName.split(' ')[0]}!` : 'Hallo!'}</h1>
        {data.guest && <p className="vhead-lede">{t('German A1 words with Uzbek meanings. A few minutes a day: each card comes back just before you’d forget it.')}</p>}
      </div>
      <div className="vhead-actions">
        <button className="icon-btn" onClick={() => ui.openSheet({ kind: 'settings' })} aria-label={t('Study settings')}>
          <Icon name="sliders" />
        </button>
      </div>
    </header>
  );

  if (data.status === 'error') return <div className="page">{head}<LoadError /></div>;
  if (!ready) {
    return (
      <div className="page">
        {head}
        <div className="panel loading" aria-busy="true">{t('Opening your card box…')}</div>
      </div>
    );
  }
  if (!data.words.size) return <div className="page">{head}<EmptyBox />{data.guest && <GuestNote />}<SyncNote /></div>;

  const q = buildQueue(data, now);
  const c = q.counts;
  const total = c.fresh + c.learning + c.review;
  const deck = currentDeck(data);
  const decks = deckCounts(data.words);
  const inScope = deck === 'all' ? data.words.size : decks.find(([d]) => d === deck)?.[1] || 0;
  const today = dayIndex(now);

  let note: string;
  if (total) {
    const secs = c.fresh * 3 * 8 + c.learning * 8 + c.review * 8; // a new card is seen about 3 times
    note = tn(inScope, 'About {m} min · {n} word in {deck}', 'About {m} min · {n} words in {deck}', {
      m: Math.max(1, Math.round(secs / 60)),
      deck: deck === 'all' ? t('all decks') : deck,
    });
  } else {
    const nx = nextDueSummary(data, now);
    if (nx.soonest) note = tn(q.learning.length, '{n} card comes back in {time}.', '{n} cards come back in {time}.', { time: span(nx.soonest - now) });
    else if (q.fresh.length && q.newLeft === 0) note = t('You reached today’s limit of {n} new cards.', { n: data.prefs.newPerDay });
    else if (nx.day === today + 1) note = tn(nx.count, 'Next reviews tomorrow: {n} card.', 'Next reviews tomorrow: {n} cards.');
    else if (nx.day != null) note = tn(nx.count, 'Next reviews on {day}: {n} card.', 'Next reviews on {day}: {n} cards.', { day: dayLong(nx.day) });
    else note = t('Nothing to study in this deck.');
  }

  const week = dueForecast(data, now, 7, deck);
  const wmax = Math.max(1, ...week);
  const forecastEmpty = week.every((n) => n === 0);
  const leeches = sortedWords(data.words).filter((w) => lapsesOf(data.cards.get(w.id)) >= LEECH_AT);

  const learnMore = () => {
    const prev = data.prefs.bonusNew?.day === today ? data.prefs.bonusNew.n : 0;
    store.setPrefs({ bonusNew: { day: today, n: prev + 10 } }, true);
    ui.startReview();
  };
  const showLeeches = () => {
    ui.setQuery(() => ({ q: '', filters: { ...EMPTY_FILTERS, status: ['leech'] } }));
    ui.setTab('words');
  };

  return (
    <div className="page">
      {head}
      <CheersBanner />
      <GuestImportBanner />
      <TodayGoal done={answersToday(data.cards.values(), now)} goal={data.prefs.dailyGoal} guest={data.guest}
        streak={shownStreak(data.streak, data.cards.values(), now)} />
      {decks.some(([d]) => d) && (
        <div className="decks" role="radiogroup" aria-label={t('Deck')}>
          <button className="chip" role="radio" aria-checked={deck === 'all'} onClick={() => store.setPrefs({ studyDeck: 'all' })}>
            {t('All decks')} <span className="n">{data.words.size}</span>
          </button>
          {/* The class's lesson comes right after "All decks", so it's in view without scrolling */}
          {decks.filter(([d]) => d).sort(([a], [b]) => Number(b === data.classLesson) - Number(a === data.classLesson)).map(([d, n]) => (
            <button key={d} className="chip" role="radio" aria-checked={deck === d} onClick={() => store.setPrefs({ studyDeck: d })}
              title={d === data.classLesson ? t('Your class is on this lesson') : undefined}>
              {d} <span className="n">{n}</span>
              {d === data.classLesson && <span className="chip-now">{t('class')}</span>}
            </button>
          ))}
          {data.course?.note && <span className="chip chip-note">{t(data.course.note)}</span>}
        </div>
      )}

      <section className="today" aria-label={t('Today')}>
        <div className="today-counts">
          <div className="tc"><span className="tc-n">{c.fresh}</span><span className="tc-l"><i className="k-new" />{t('New')}</span></div>
          <div className="tc"><span className="tc-n">{c.learning}</span><span className="tc-l"><i className="k-learn" />{t('Learning')}</span></div>
          <div className="tc"><span className="tc-n">{c.review}</span><span className="tc-l"><i className="k-due" />{t('To review')}</span></div>
        </div>
        <button className="btn btn-primary btn-xl" onClick={ui.startReview} disabled={!total}>
          {t(total ? 'Study now' : 'All caught up')}
        </button>
        {!total && q.fresh.length > 0 && q.newLeft === 0 && (
          <button className="btn" onClick={learnMore}>{t('Learn 10 more new words')}</button>
        )}
        <p className="today-note">{note}</p>
      </section>

      {data.guest && <GuestNote />}

      <section className="panel" aria-labelledby="week-h">
        <div className="panel-h">
          <h2 id="week-h">{t('Coming up')}</h2>
          <span className="muted">{t('cards due per day')}</span>
        </div>
        {forecastEmpty ? (
          <p className="muted small">{t('No reviews planned yet. Study a few cards and you’ll see here when they come back.')}</p>
        ) : (
          <div className="week">
            {week.map((n, i) => (
              <div key={i} className={`wk${i === 0 ? ' is-today' : ''}`}>
                <span className="wk-n">{n || ''}</span>
                <span className="wk-plot"><i style={{ height: `${((n / wmax) * 100).toFixed(1)}%` }} /></span>
                <span className="wk-d" lang="de">{weekday(today + i)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {leeches.length > 0 && (
        <button className="row-link" onClick={showLeeches}>
          <Icon name="alert" />
          <span className="grow">
            <b>{tn(leeches.length, '{n} leech', '{n} leeches')}</b>
            <br />
            <span className="muted small">{t('Words you keep forgetting. A memory hook helps most here.')}</span>
          </span>
        </button>
      )}
      <SyncNote />
    </div>
  );
}
