'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useNow } from '@/lib/client/hooks';
import { useStore } from '@/lib/client/store';
import { compareText, deckCounts, wordInfo } from '@/lib/queue';
import { genderOf } from '@/lib/text';
import { dayIndex, plural } from '@/lib/time';
import { POS_OPTIONS } from '@/lib/types';
import { EMPTY_FILTERS, FILTER_LABEL, matchesStatus, SORTS, STATUS_OPTS, toCSV, visibleRows, type FilterGroup, type SortKey } from '@/lib/words-view';
import { BottomSheet } from './BottomSheet';
import { Icon } from './ui';
import { useUI } from './ui-context';
import { COLUMNS, DEFAULT_FIELDS } from './WordsView';

interface Option {
  value: string;
  label: string;
  count: number;
  art?: string;
}

export function FilterSheet() {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const { filters } = ui.query;

  const groups = useMemo(() => {
    const today = dayIndex(now);
    const words = [...data.words.values()];
    const infos = words.map((w) => wordInfo(data, w, today));
    const count = (pred: (i: number) => boolean) => words.reduce((n, _w, k) => n + (pred(k) ? 1 : 0), 0);
    const tags = [...new Set(words.flatMap((w) => w.tags || []))].sort(compareText);
    const out: Record<FilterGroup, Option[]> = {
      deck: deckCounts(data.words).map(([d, n]) => ({ value: d, label: d || '(no deck)', count: n })),
      status: STATUS_OPTS.map(([k, l]) => ({ value: k, label: l, count: count((i) => matchesStatus(k, infos[i])) })),
      gender: (['der', 'die', 'das', 'none'] as const).map((k) => ({
        value: k, label: k === 'none' ? 'no article' : k, art: k === 'none' ? undefined : k,
        count: count((i) => (genderOf(words[i].term) || 'none') === k),
      })),
      pos: POS_OPTIONS.filter(([k]) => words.some((w) => (w.pos || 'other') === k)).map(([k, l]) => ({
        value: k, label: l, count: count((i) => (words[i].pos || 'other') === k),
      })),
      tag: tags.map((t) => ({ value: t, label: t, count: count((i) => (words[i].tags || []).includes(t)) })),
    };
    return out;
  }, [data, now]);

  const shown = useMemo(() => visibleRows(data, now, ui.query.q, filters, ui.sort).length, [data, now, ui.query.q, filters, ui.sort]);
  const toggle = (group: FilterGroup, value: string) =>
    ui.setQuery((s) => {
      const list = s.filters[group];
      return { ...s, filters: { ...s.filters, [group]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } };
    });

  return (
    <BottomSheet
      title="Filter words"
      footer={
        <>
          <button className="btn" onClick={() => ui.setQuery(() => ({ q: '', filters: EMPTY_FILTERS }))}>Clear all</button>
          <button className="btn btn-primary" onClick={ui.closeSheet}>Show {plural(shown, 'word', 'words')}</button>
        </>
      }
    >
      <div className="form">
        {(Object.keys(groups) as FilterGroup[]).filter((g) => groups[g].length).map((group) => (
          <fieldset key={group}>
            <legend>{FILTER_LABEL[group]}</legend>
            <div className="chipset">
              {groups[group].map((o) => (
                <button key={o.value} type="button" className="chip" aria-pressed={filters[group].includes(o.value)} onClick={() => toggle(group, o.value)}>
                  {o.art ? <span className={`art art-${o.art}`}>{o.label}</span> : o.label} <span className="n">{o.count}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </BottomSheet>
  );
}

export function SortSheet() {
  const ui = useUI();
  const set = (key: SortKey, dir = SORTS[key]?.dir ?? 'asc') => ui.setSort({ key, dir });
  return (
    <BottomSheet title="Sort words">
      <div className="form">
        <div className="optlist" role="radiogroup" aria-label="Sort by">
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <button key={k} className="opt" role="radio" aria-checked={ui.sort.key === k} onClick={() => set(k)}>
              <span>{SORTS[k]!.label}</span>
              <Icon name="check" />
            </button>
          ))}
        </div>
        <span className="seg" role="group" aria-label="Direction" style={{ justifySelf: 'start' }}>
          <button className="seg-btn" aria-pressed={ui.sort.dir === 'asc'} onClick={() => set(ui.sort.key, 'asc')}>Ascending</button>
          <button className="seg-btn" aria-pressed={ui.sort.dir === 'desc'} onClick={() => set(ui.sort.key, 'desc')}>Descending</button>
        </span>
      </div>
    </BottomSheet>
  );
}

export function FieldsSheet() {
  const ui = useUI();
  const toggle = (key: string, on: boolean) =>
    ui.setFields(COLUMNS.map((c) => c.key as string).filter((k) => (k === key ? on : ui.fields.includes(k))));
  return (
    <BottomSheet
      title="Fields in the table"
      footer={
        <>
          <button className="btn" onClick={() => ui.setFields(DEFAULT_FIELDS)}>Default fields</button>
          <button className="btn btn-primary" onClick={ui.closeSheet}>Done</button>
        </>
      }
    >
      <div>
        <label className="toggle-row">
          <input type="checkbox" checked disabled />
          <span>Word<small>Always shown</small></span>
        </label>
        {COLUMNS.map((c) => (
          <label key={c.key} className="toggle-row">
            <input type="checkbox" checked={ui.fields.includes(c.key)} onChange={(e) => toggle(c.key, e.target.checked)} />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </BottomSheet>
  );
}

export function MoreSheet() {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const rows = visibleRows(data, now, ui.query.q, ui.query.filters, ui.sort);
  const copy = () => {
    const csv = toCSV(rows);
    const fallback = () => ui.openSheet({ kind: 'csv', text: csv });
    try {
      navigator.clipboard.writeText(csv).then(() => {
        ui.closeSheet();
        ui.toast('Copied as CSV');
      }, fallback);
    } catch {
      fallback();
    }
  };
  return (
    <BottomSheet title="Word list">
      <div className="optlist show-icons">
        <button className="opt" onClick={copy}>Copy {plural(rows.length, 'word', 'words')} as CSV <Icon name="copy" /></button>
        {data.me && data.ai && (
          <button className="opt" onClick={() => ui.openSheet({ kind: 'ai' })}>Add words with AI (photo or list) <Icon name="sparkle" /></button>
        )}
        {data.me && (
          <button className="opt" onClick={() => ui.openSheet({ kind: 'import' })}>Import a pasted list <Icon name="paste" /></button>
        )}
      </div>
      <p className="hint">CSV pastes straight into Excel, Google Sheets or Airtable.</p>
    </BottomSheet>
  );
}

/** Shown when the clipboard is not available: select the text and copy it by hand. */
export function CsvSheet({ text }: { text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <BottomSheet title="Copy as CSV">
      <p className="lede">Select all and copy.</p>
      <textarea className="csv-out" ref={ref} readOnly value={text} />
    </BottomSheet>
  );
}
