'use client';

import { useMemo, useState } from 'react';
import { useNow } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { useStore } from '@/lib/client/store';
import { computeStats } from '@/lib/queue';
import { dayLong, weekday } from '@/lib/time';
import { EmptyBox, LoadError, Term } from './ui';
import { useUI } from './ui-context';

const FACH_RANGE = ['new & learning', '1–2 days', '3–7 days', '8–20 days', '21+ days'];

export function StatsView() {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const { t, tn } = useT();
  const ready = data.status === 'ready' && now > 0;
  const st = useMemo(() => (ready ? computeStats(data, now) : null), [ready, data, now]);
  const [fcSel, setFcSel] = useState<number | null>(null);
  const [rvSel, setRvSel] = useState<number | null>(null);

  const head = (
    <header className="vhead">
      <div>
        <p className="eyebrow">{t('Progress')}</p>
        <h1>{t('Your Karteikasten')}</h1>
      </div>
    </header>
  );
  if (data.status === 'error') return <div className="page">{head}<LoadError /></div>;
  if (!st) return <div className="page">{head}<div className="panel loading" aria-busy="true">{t('Counting your cards…')}</div></div>;
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
  const dayName = (di: number) => (di === st.today ? t('Today') : dayLong(di));
  const dueOn = (k: number) => tn(fc[k], '{day}: {n} card due', '{day}: {n} cards due', { day: dayName(st.today + k) });
  const answeredOn = (k: number) => t('{day}: {ok} remembered, {again} again', { day: dayName(st.days[k].di), ok: st.days[k].ok, again: st.days[k].again });

  const fcRead = fcSel == null
    ? tn(fcTotal, '{n} card due in the next two weeks. Tap a day for its count.', '{n} cards due in the next two weeks. Tap a day for its count.')
    : dueOn(fcSel);
  const rvRead = rvSel == null
    ? tn(revTotal, '{n} answer in the last two weeks. Tap a day for details.', '{n} answers in the last two weeks. Tap a day for details.')
    : answeredOn(rvSel);

  return (
    <div className="page">
      {head}
      <div className="tiles">
        <div className="tile">
          <p className="tile-l">{t('Streak')}</p>
          <p className="tile-v">{st.streak}<span className="unit"> {t(st.streak === 1 ? 'day' : 'days')}</span></p>
          <p className="tile-s">{t('in a row with reviews')}</p>
        </div>
        <div className="tile">
          <p className="tile-l">{t('Retention')}</p>
          <p className="tile-v">{st.retention == null ? '–' : `${Math.round(st.retention * 100)}%`}</p>
          <p className="tile-s">{st.retN ? t('of {n} reviews, 30 days', { n: st.retN }) : t('shows after your first reviews')}</p>
        </div>
        <div className="tile">
          <p className="tile-l">{t('Answers today')}</p>
          <p className="tile-v">{st.todayN}</p>
          <p className="tile-s">{t('all card types')}</p>
        </div>
        <div className="tile">
          <p className="tile-l">{t('Mature')}</p>
          <p className="tile-v">{st.fach[4]}<span className="unit"> / {st.total}</span></p>
          <p className="tile-s">{t('cards at 21+ days')}</p>
        </div>
      </div>

      <section className="panel" aria-labelledby="kasten-h">
        <div className="panel-h">
          <h2 id="kasten-h">{t('Card box')}</h2>
          <span className="muted">{t('by review interval')}</span>
        </div>
        <div className="kasten" role="list">
          {st.fach.map((n, k) => (
            <div key={k} className="fach" role="listitem" aria-label={tn(n, 'Compartment {k}, {range}: {n} card', 'Compartment {k}, {range}: {n} cards', { k: k + 1, range: t(FACH_RANGE[k]) })}>
              <span className="fach-n">{n}</span>
              <span className="fach-box"><span className={`fach-fill f${k + 1}`} style={{ height: `${((n / fmax) * 100).toFixed(1)}%` }} /></span>
              <span className="fach-name" lang="de">Fach {k + 1}</span>
              <span className="fach-range">{t(FACH_RANGE[k])}</span>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          {t('Cards move right each time you remember them, like in Sebastian Leitner’s paper Karteikasten.')}
        </p>
      </section>

      <section className="panel" aria-labelledby="fc-h">
        <div className="panel-h">
          <h2 id="fc-h">{t('Next 14 days')}</h2>
          <span className="muted">{t('cards due')}</span>
        </div>
        <p className="chart-read" aria-live="polite">{fcRead}</p>
        <div className="cols">
          {fc.map((n, k) => (
            <button key={k} className={`col${k === 0 ? ' is-today' : ''}${fcSel === k ? ' is-sel' : ''}`} onClick={() => setFcSel(k)}
              aria-label={dueOn(k)}>
              <span className="col-val">{n > 0 && (k === fcPeak || k === 0) ? n : ''}</span>
              <span className="col-plot"><span className="col-bar" style={{ height: `${((n / fcMax) * 100).toFixed(1)}%` }} /></span>
              <span className="col-x" lang="de">{weekday(st.today + k)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="rv-h">
        <div className="panel-h">
          <h2 id="rv-h">{t('Last 14 days')}</h2>
          <span className="muted">{t('answers per day')}</span>
        </div>
        <p className="chart-read" aria-live="polite">{rvRead}</p>
        <div className="cols">
          {st.days.map((d, k) => (
            <button key={d.di} className={`col${d.di === st.today ? ' is-today' : ''}${rvSel === k ? ' is-sel' : ''}`} onClick={() => setRvSel(k)}
              aria-label={answeredOn(k)}>
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
          <span><i className="seg-ok" />{t('Remembered')}</span>
          <span><i className="seg-again" />{t('Again')}</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="hard-h">
        <div className="panel-h">
          <h2 id="hard-h">{t('Hardest words')}</h2>
          <span className="muted">{t('most lapses, lowest ease')}</span>
        </div>
        {st.hard.length ? (
          <div className="hard-list">
            {st.hard.map(({ w, lapses, ease }) => (
              <button key={w.id} className="hard-row" onClick={() => ui.openSheet({ kind: 'word', id: w.id })}>
                <span className="grow">
                  <span className="t" lang="de"><Term term={w.term} /></span>
                  <span className="m">{w.meaning}</span>
                </span>
                <span className="num">{tn(lapses, '{n} lapse', '{n} lapses')}<br />{t('ease {p}%', { p: Math.round(ease * 100) })}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted small">{t('No struggling words yet. Words you press Hard or Again on show up here.')}</p>
        )}
      </section>
    </div>
  );
}
