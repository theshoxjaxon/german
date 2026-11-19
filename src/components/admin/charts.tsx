'use client';

import { useState } from 'react';

/**
 * Columns over time (days or weeks), stacked when there are several series. Tap or hover a
 * column to read its numbers in the line above the chart; the newest column is shown first.
 */
export function ColumnChart({ labels, series, legend, describe, className }: {
  labels: string[]; // text under each column ('' for none)
  series: { values: number[]; className: string }[]; // bottom to top
  legend?: { label: string; className: string }[];
  describe: (i: number) => string;
  className?: string; // grid width, e.g. 'cols-30'
}) {
  const [sel, setSel] = useState<number | null>(null);
  const totals = labels.map((_, i) => series.reduce((n, s) => n + s.values[i], 0));
  const max = Math.max(1, ...totals);
  const peak = totals.indexOf(Math.max(...totals));
  const last = labels.length - 1;
  return (
    <>
      <p className="chart-read" aria-live="polite">{describe(sel ?? last)}</p>
      <div className={`cols ${className ?? ''}`} onMouseLeave={() => setSel(null)}>
        {labels.map((label, i) => (
          <button key={i} className={`col${i === last ? ' is-today' : ''}${sel === i ? ' is-sel' : ''}`}
            onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} aria-label={describe(i)}>
            <span className="col-val">{totals[i] > 0 && (i === peak || i === last) ? totals[i] : ''}</span>
            <span className="col-plot">
              <span className="col-stack" style={{ height: `${((totals[i] / max) * 100).toFixed(1)}%` }}>
                {[...series].reverse().map((s, k) => (s.values[i] > 0 ? <span key={k} className={s.className} style={{ flex: s.values[i] }} /> : null))}
              </span>
            </span>
            <span className="col-x">{label}</span>
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

/** A tiny trend for a stat tile: one bar per week, the newest one dark. Empty weeks stay empty. */
export function Spark({ values }: { values: (number | null)[] }) {
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  return (
    <span className="spark" aria-hidden="true">
      {values.map((v, i) => (
        <i key={i} className={v === null ? 'is-empty' : undefined} style={{ height: v && max ? `${Math.max(8, (v / max) * 100)}%` : undefined }} />
      ))}
    </span>
  );
}
