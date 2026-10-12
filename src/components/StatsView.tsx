'use client';

import { useMemo, useState } from 'react';
import { useNow } from '@/lib/client/hooks';
import { useStore } from '@/lib/client/store';
import { computeStats } from '@/lib/queue';
import { dayLong, plural, weekday } from '@/lib/time';
import { EmptyBox, LoadError, Term } from './ui';
import { useUI } from './ui-context';

const FACH_RANGE = ['new & learning', '1–2 days', '3–7 days', '8–20 days', '21+ days'];

export function StatsView() {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const ready = data.status === 'ready' && now > 0;
  const st = useMemo(() => (ready ? computeStats(data, now) : null), [ready, data, now]);
  const [fcSel, setFcSel] = useState<number | null>(null);
  const [rvSel, setRvSel] = useState<number | null>(null);

  const head = (
    <header className="vhead">
      <div>
        <p className="eyebrow">Progress</p>
        <h1>Your Karteikasten</h1>
      </div>
    </header>
  );
  if (data.status === 'error') return <div className="page">{head}<LoadError /></div>;
  if (!st) return <div className="page">{head}<div className="panel loading" aria-busy="true">Counting your cards…</div></div>;
  if (!data.words.size) return <div className="page">{head}<EmptyBox /></div>;

  const fmax = Math.max(1, ...st.fach);
  const fc = st.forecast;
  const fcMax = Math.max(1, ...fc);
  const fcPeak = fc.indexOf(Math.max(...fc));
  const fcTotal = fc.reduce((a, b) => a + b, 0);
  const dTot = st.days.map((d) => d.ok + d.again);
  const dMax = Math.max(1, ...dTot);
  const dPeak = dTot.indexOf(Math.max(...dTot));
  const revTotal = dTot.reduce((a, b) => a + b, 0);
  const dayName = (di: number) => (di === st.today ? 'Today' : dayLong(di));

  const fcRead = fcSel == null
    ? `${plural(fcTotal, 'card', 'cards')} due in the next two weeks. Tap a day for its count.`
    : `${dayName(st.today + fcSel)}: ${plural(fc[fcSel], 'card', 'cards')} due`;
  const rvRead = rvSel == null
    ? `${plural(revTotal, 'answer', 'answers')} in the last two weeks. Tap a day for details.`
    : `${dayName(st.days[rvSel].di)}: ${st.days[rvSel].ok} remembered, ${st.days[rvSel].again} again`;

  return (
    <div className="page">
      {head}
      <div className="tiles">
        <div className="tile">
          <p className="tile-l">Streak</p>
          <p className="tile-v">{st.streak}<span className="unit"> {st.streak === 1 ? 'day' : 'days'}</span></p>
          <p className="tile-s">in a row with reviews</p>
        </div>
        <div className="tile">
          <p className="tile-l">Retention</p>
          <p className="tile-v">{st.retention == null ? '–' : `${Math.round(st.retention * 100)}%`}</p>
          <p className="tile-s">{st.retN ? `of ${st.retN} reviews, 30 days` : 'shows after your first reviews'}</p>
        </div>
        <div className="tile">
          <p className="tile-l">Answers today</p>
          <p className="tile-v">{st.todayN}</p>
          <p className="tile-s">all card types</p>
        </div>
        <div className="tile">
          <p className="tile-l">Mature</p>
          <p className="tile-v">{st.fach[4]}<span className="unit"> / {st.total}</span></p>
          <p className="tile-s">cards at 21+ days</p>
        </div>
      </div>

      <section className="panel" aria-labelledby="kasten-h">
        <div className="panel-h">
          <h2 id="kasten-h">Card box</h2>
          <span className="muted">by review interval</span>
        </div>
        <div className="kasten" role="list">
          {st.fach.map((n, k) => (
            <div key={k} className="fach" role="listitem" aria-label={`Compartment ${k + 1}, ${FACH_RANGE[k]}: ${plural(n, 'card', 'cards')}`}>
              <span className="fach-n">{n}</span>
              <span className="fach-box"><span className={`fach-fill f${k + 1}`} style={{ height: `${((n / fmax) * 100).toFixed(1)}%` }} /></span>
              <span className="fach-name" lang="de">Fach {k + 1}</span>
              <span className="fach-range">{FACH_RANGE[k]}</span>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Cards move right each time you remember them, like in Sebastian Leitner’s paper Karteikasten.
        </p>
      </section>

      <section className="panel" aria-labelledby="fc-h">
        <div className="panel-h">
          <h2 id="fc-h">Next 14 days</h2>
          <span className="muted">cards due</span>
        </div>
        <p className="chart-read" aria-live="polite">{fcRead}</p>
        <div className="cols">
          {fc.map((n, k) => (
            <button key={k} className={`col${k === 0 ? ' is-today' : ''}${fcSel === k ? ' is-sel' : ''}`} onClick={() => setFcSel(k)}
              aria-label={`${dayName(st.today + k)}: ${plural(n, 'card', 'cards')} due`}>
              <span className="col-val">{n > 0 && (k === fcPeak || k === 0) ? n : ''}</span>
              <span className="col-plot"><span className="col-bar" style={{ height: `${((n / fcMax) * 100).toFixed(1)}%` }} /></span>
              <span className="col-x" lang="de">{weekday(st.today + k)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="rv-h">
        <div className="panel-h">
          <h2 id="rv-h">Last 14 days</h2>
          <span className="muted">answers per day</span>
        </div>
        <p className="chart-read" aria-live="polite">{rvRead}</p>
        <div className="cols">
          {st.days.map((d, k) => (
            <button key={d.di} className={`col${d.di === st.today ? ' is-today' : ''}${rvSel === k ? ' is-sel' : ''}`} onClick={() => setRvSel(k)}
              aria-label={`${dayName(d.di)}: ${d.ok} remembered, ${d.again} again`}>
              <span className="col-val">{dTot[k] > 0 && (k === dPeak || d.di === st.today) ? dTot[k] : ''}</span>
              <span className="col-plot">
                <span className="col-stack" style={{ height: `${((dTot[k] / dMax) * 100).toFixed(1)}%` }}>
                  {d.again > 0 && <span className="seg-again" style={{ flex: d.again }} />}
                  {d.ok > 0 && <span className="seg-ok" style={{ flex: d.ok }} />}
                </span>
              </span>
              <span className="col-x" lang="de">{weekday(d.di)}</span>
            </button>
          ))}
        </div>
        <div className="legend">
          <span><i className="seg-ok" />Remembered</span>
          <span><i className="seg-again" />Again</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="hard-h">
        <div className="panel-h">
          <h2 id="hard-h">Hardest words</h2>
          <span className="muted">most lapses, lowest ease</span>
        </div>
        {st.hard.length ? (
          <div className="hard-list">
            {st.hard.map(({ w, lapses, ease }) => (
              <button key={w.id} className="hard-row" onClick={() => ui.openSheet({ kind: 'word', id: w.id })}>
                <span className="grow">
                  <span className="t" lang="de"><Term term={w.term} /></span>
                  <span className="m">{w.meaning}</span>
                </span>
                <span className="num">{plural(lapses, 'lapse', 'lapses')}<br />ease {Math.round(ease * 100)}%</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted small">No struggling words yet. Words you press Hard or Again on show up here.</p>
        )}
      </section>
    </div>
  );
}
