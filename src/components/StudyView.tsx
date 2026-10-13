'use client';

import { useNow } from '@/lib/client/hooks';
import { store, useStore } from '@/lib/client/store';
import { buildQueue, currentDeck, deckCounts, dueForecast, LEECH_AT, lapsesOf, nextDueSummary, sortedWords } from '@/lib/queue';
import { dayIndex, dayLong, fmtSpan, plural, studyDayTitle, weekday } from '@/lib/time';
import { EMPTY_FILTERS } from '@/lib/words-view';
import { CheersBanner } from './ClassView';
import { GuestImportBanner, GuestNote } from './GuestViews';
import { EmptyBox, Icon, LoadError, SyncNote } from './ui';
import { useUI } from './ui-context';

export function StudyView() {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const ready = data.status === 'ready' && now > 0;

  const head = (
    <header className="vhead">
      <div>
        <p className="eyebrow" lang="de">{ready ? studyDayTitle(now) : ' '}</p>
        <h1 lang="de">{data.me ? `Hallo, ${data.me.displayName.split(' ')[0]}!` : 'Hallo!'}</h1>
      </div>
      <div className="vhead-actions">
        <button className="icon-btn" onClick={() => ui.openSheet({ kind: 'settings' })} aria-label="Study settings">
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
        <div className="panel loading" aria-busy="true">Opening your card box…</div>
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
    note = `About ${Math.max(1, Math.round(secs / 60))} min · ${plural(inScope, 'word', 'words')} in ${deck === 'all' ? 'all decks' : deck}`;
  } else {
    const nx = nextDueSummary(data, now);
    if (nx.soonest) note = `${plural(q.learning.length, 'card comes', 'cards come')} back in ${fmtSpan(nx.soonest - now)}.`;
    else if (q.fresh.length && q.newLeft === 0) note = `You reached today’s limit of ${data.prefs.newPerDay} new cards.`;
    else if (nx.day != null) note = `Next reviews ${nx.day === today + 1 ? 'tomorrow' : 'on ' + dayLong(nx.day)}: ${plural(nx.count, 'card', 'cards')}.`;
    else note = 'Nothing to study in this deck.';
  }

  const week = dueForecast(data, now, 7, deck);
  const wmax = Math.max(1, ...week);
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
      {decks.some(([d]) => d) && (
        <div className="decks" role="radiogroup" aria-label="Deck">
          <button className="chip" role="radio" aria-checked={deck === 'all'} onClick={() => store.setPrefs({ studyDeck: 'all' })}>
            All decks <span className="n">{data.words.size}</span>
          </button>
          {decks.filter(([d]) => d).map(([d, n]) => (
            <button key={d} className="chip" role="radio" aria-checked={deck === d} onClick={() => store.setPrefs({ studyDeck: d })}>
              {d} <span className="n">{n}</span>
            </button>
          ))}
        </div>
      )}

      <section className="today" aria-label="Today">
        <div className="today-counts">
          <div className="tc"><span className="tc-n">{c.fresh}</span><span className="tc-l"><i className="k-new" />New</span></div>
          <div className="tc"><span className="tc-n">{c.learning}</span><span className="tc-l"><i className="k-learn" />Learning</span></div>
          <div className="tc"><span className="tc-n">{c.review}</span><span className="tc-l"><i className="k-due" />To review</span></div>
        </div>
        <button className="btn btn-primary btn-xl" onClick={ui.startReview} disabled={!total}>
          {total ? 'Study now' : 'All caught up'}
        </button>
        {!total && q.fresh.length > 0 && q.newLeft === 0 && (
          <button className="btn" onClick={learnMore}>Learn 10 more new words</button>
        )}
        <p className="today-note">{note}</p>
      </section>

      {data.guest && <GuestNote />}

      <section className="panel" aria-labelledby="week-h">
        <div className="panel-h">
          <h2 id="week-h">Coming up</h2>
          <span className="muted">cards due per day</span>
        </div>
        <div className="week">
          {week.map((n, i) => (
            <div key={i} className={`wk${i === 0 ? ' is-today' : ''}`}>
              <span className="wk-n">{n || ''}</span>
              <span className="wk-plot"><i style={{ height: `${((n / wmax) * 100).toFixed(1)}%` }} /></span>
              <span className="wk-d" lang="de">{weekday(today + i)}</span>
            </div>
          ))}
        </div>
      </section>

      {leeches.length > 0 && (
        <button className="row-link" onClick={showLeeches}>
          <Icon name="alert" />
          <span className="grow">
            <b>{plural(leeches.length, 'leech', 'leeches')}</b>
            <br />
            <span className="muted small">Words you keep forgetting. A memory hook helps most here.</span>
          </span>
        </button>
      )}
      <SyncNote />
    </div>
  );
}
