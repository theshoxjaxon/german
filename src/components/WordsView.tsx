'use client';

import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { useCourseLang } from '@/lib/client/course';
import { useNow } from '@/lib/client/hooks';
import { useT, type Translator } from '@/lib/client/i18n';
import { useStore } from '@/lib/client/store';
import type { WordInfo } from '@/lib/queue';
import { dayIndex, DAY, shortDate } from '@/lib/time';
import { addsSharedWords } from '@/lib/ownership';
import { POS_LABEL, type Word } from '@/lib/types';
import { activeFilterCount, FILTER_LABEL, SORTS, STATUS_OPTS, visibleRows, type FilterGroup, type Row, type SortKey } from '@/lib/words-view';
import { EmptyBox, Icon, LoadError, StatusPill, Term } from './ui';
import { useUI } from './ui-context';

export function dueLabel(i: WordInfo, now: number, { t, tn, span }: Translator): string {
  if (i.status === 'suspended') return t('Paused');
  if (!i.s || i.s.type === 'new') return '–';
  if (i.s.type !== 'review') {
    const d = i.s.due - now;
    return d <= 0 ? t('Now') : t('in {time}', { time: span(d) });
  }
  const diff = dayIndex(i.s.due) - dayIndex(now);
  if (diff < 0) return tn(-diff, '{n} day late', '{n} days late');
  if (diff === 0) return t('Today');
  if (diff === 1) return t('Tomorrow');
  if (diff < 14) return t('in {n} days', { n: diff });
  return shortDate(i.s.due);
}

interface Column {
  key: SortKey | 'tags';
  label: string;
  sortable?: boolean;
  num?: boolean;
  clip?: boolean;
  className?: string;
  lang?: string;
  cell: (w: Word, i: WordInfo, now: number, tr: Translator) => ReactNode;
}

export const COLUMNS: Column[] = [
  { key: 'meaning', label: 'Meaning', clip: true, cell: (w) => w.meaning },
  { key: 'status', label: 'Status', cell: (_w, i) => <StatusPill info={i} /> },
  { key: 'due', label: 'Due', cell: (_w, i, now, tr) => dueLabel(i, now, tr) },
  { key: 'ease', label: 'Ease', num: true, cell: (_w, i) => (i.ease ? `${Math.round(i.ease * 100)}%` : '–') },
  { key: 'ivl', label: 'Interval', num: true, cell: (_w, i, _now, tr) => (i.ivl ? tr.span(i.ivl * DAY) : '–') },
  { key: 'lapses', label: 'Lapses', num: true, cell: (_w, i) => i.lapses || '–' },
  { key: 'pos', label: 'Type', cell: (w, _i, _now, tr) => tr.t(POS_LABEL[w.pos] || '') },
  {
    key: 'tags', label: 'Tags', sortable: false,
    cell: (w) => <span className="tags">{(w.tags || []).map((t) => <span key={t} className="tag">{t}</span>)}</span>,
  },
  { key: 'deck', label: 'Deck', cell: (w) => w.deck },
  { key: 'pronunciation', label: 'Pronunciation', className: 'ipa-cell', cell: (w) => w.pronunciation },
  { key: 'forms', label: 'Forms', clip: true, lang: 'de', cell: (w) => w.forms },
  { key: 'example', label: 'Example', clip: true, lang: 'de', cell: (w) => w.example },
  { key: 'exampleTr', label: 'Translation', clip: true, cell: (w) => w.exampleTr },
  { key: 'mnemonic', label: 'Memory hook', clip: true, cell: (w) => w.mnemonic },
  { key: 'notes', label: 'Notes', clip: true, cell: (w) => w.notes },
];
export const DEFAULT_FIELDS = ['meaning', 'status', 'due', 'ease', 'pos', 'tags', 'pronunciation', 'example', 'mnemonic', 'deck'];
export const isFieldList = (v: unknown) => Array.isArray(v) && v.every((k) => COLUMNS.some((c) => c.key === k));

export function WordsView() {
  const data = useStore();
  const now = useNow();
  const ui = useUI();
  const { t } = useT();
  const { q, filters } = ui.query;
  const ready = data.status === 'ready' && now > 0;
  const rows = useMemo(() => (ready ? visibleRows(data, now, q, filters, ui.sort) : []), [ready, data, now, q, filters, ui.sort]);
  const nf = activeFilterCount(filters);
  const total = data.words.size;
  const canAdd = !!data.me; // students add their own words, teachers add lesson words

  const setQ = (value: string) => ui.setQuery((s) => ({ ...s, q: value }));
  const removeFilter = (group: FilterGroup, value: string) =>
    ui.setQuery((s) => ({ ...s, filters: { ...s.filters, [group]: s.filters[group].filter((v) => v !== value) } }));
  const filterLabel = (group: FilterGroup, v: string) =>
    group === 'status' ? t(STATUS_OPTS.find(([k]) => k === v)?.[1] ?? v)
      : group === 'pos' ? t(POS_LABEL[v as Word['pos']] ?? v)
        : group === 'gender' && v === 'none' ? t('no article')
          : v || t('(no deck)');

  let body: ReactNode;
  if (data.status === 'error') body = <div className="body-msg"><LoadError /></div>;
  else if (!ready) body = <p className="body-msg">{t('Loading your words…')}</p>;
  else if (!total) body = <div className="body-msg"><EmptyBox /></div>;
  else if (!rows.length) {
    body = (
      <div className="body-msg">
        <p>{t('No words match your search and filters.')}</p>
        <button className="btn" onClick={() => ui.setQuery(() => ({ q: '', filters: { deck: [], status: [], gender: [], pos: [], tag: [] } }))}>
          {t('Clear search and filters')}
        </button>
      </div>
    );
  } else body = ui.layout === 'gallery' ? <Gallery rows={rows} now={now} /> : <WordTable rows={rows} now={now} />;

  return (
    <>
      <header className="vhead">
        <div>
          <p className="eyebrow">{t(addsSharedWords(data.me) ? 'Word database' : data.me ? 'Lesson words + your own' : 'Lesson words · sign up to add your own')}</p>
          <h1 id="h-words">
            {t('Words')}
            {ready && <span className="count">{rows.length === total ? total : `${rows.length}/${total}`}</span>}
          </h1>
        </div>
        <div className="vhead-actions">
          {canAdd && data.ai && (
            <button className="icon-btn ai-btn" onClick={() => ui.openSheet({ kind: 'ai' })} aria-label={t('Add words with AI')}><Icon name="sparkle" /></button>
          )}
          {canAdd && (
            <button className="icon-btn" onClick={() => ui.openSheet({ kind: 'import' })} aria-label={t('Import a word list')}><Icon name="paste" /></button>
          )}
          <button className="icon-btn" onClick={() => ui.openSheet({ kind: 'more' })} aria-label={t('More actions')}><Icon name="more" /></button>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <span className="sr-only">{t('Search words')}</span>
          <input
            id="w-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Search words, meanings, examples')}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {q && (
            <button className="icon-btn" onClick={() => setQ('')} aria-label={t('Clear search')}><Icon name="x" /></button>
          )}
        </label>
        <div className="ctrl-row">
          <button className={`ctrl${nf ? ' is-on' : ''}`} onClick={() => ui.openSheet({ kind: 'filter' })}>
            <Icon name="filter" />{t('Filter')}{nf > 0 && <> <span className="badge">{nf}</span></>}
          </button>
          <button className={`ctrl${ui.sort.key !== 'source' ? ' is-on' : ''}`} onClick={() => ui.openSheet({ kind: 'sort' })}>
            <Icon name="sort" />{t(SORTS[ui.sort.key]?.short ?? 'Sort')}
          </button>
          <span className="seg" role="group" aria-label={t('Layout')}>
            <button className="seg-btn" aria-pressed={ui.layout === 'table'} onClick={() => ui.setLayout('table')}><Icon name="table" />{t('Table')}</button>
            <button className="seg-btn" aria-pressed={ui.layout === 'gallery'} onClick={() => ui.setLayout('gallery')}><Icon name="grid" />{t('Cards')}</button>
          </span>
          {ui.layout === 'table' && (
            <button className="ctrl" onClick={() => ui.openSheet({ kind: 'fields' })}><Icon name="eye" />{t('Fields')}</button>
          )}
        </div>
      </div>

      {nf > 0 && (
        <div className="active-filters">
          {(Object.keys(filters) as FilterGroup[]).flatMap((group) =>
            filters[group].map((v) => (
              <button key={`${group}:${v}`} className="fchip" onClick={() => removeFilter(group, v)} aria-label={t('Remove filter {group}: {value}', { group: t(FILTER_LABEL[group]), value: filterLabel(group, v) })}>
                {t(FILTER_LABEL[group])}: {filterLabel(group, v)}
                <Icon name="x" />
              </button>
            )),
          )}
        </div>
      )}

      <div className="scroller" tabIndex={-1}>{body}</div>
      {ready && canAdd && (
        <button className="fab" onClick={() => ui.openSheet({ kind: 'word', id: null })} aria-label={t('Add a word')}>
          <Icon name="plus" />
        </button>
      )}
    </>
  );
}

function WordTable({ rows, now }: { rows: Row[]; now: number }) {
  const ui = useUI();
  const tr = useT();
  const lang = useCourseLang();
  const { t } = tr;
  const cols = COLUMNS.filter((c) => ui.fields.includes(c.key));
  const sortBy = (key: SortKey) => {
    if (ui.sort.key === key) ui.setSort({ key, dir: ui.sort.dir === 'asc' ? 'desc' : 'asc' });
    else ui.setSort({ key, dir: SORTS[key]?.dir ?? 'asc' });
  };
  const th = (key: SortKey, label: string, className = '') => {
    const on = ui.sort.key === key;
    return (
      <th key={key} scope="col" className={className} aria-sort={on ? (ui.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button className="th-btn" onClick={() => sortBy(key)}>
          {label}
          {on && <span className="sort-ind" aria-hidden="true">{ui.sort.dir === 'asc' ? '↑' : '↓'}</span>}
        </button>
      </th>
    );
  };
  const open = (id: string) => ui.openSheet({ kind: 'word', id });
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      open(id);
    }
  };

  return (
    <table className="tbl">
      <thead>
        <tr>
          {th('term', t('Word'), 'c-term')}
          {cols.map((c) =>
            c.sortable === false ? (
              <th key={c.key} scope="col" className="th-plain">{t(c.label)}</th>
            ) : (
              th(c.key as SortKey, t(c.label), c.num ? 'num' : '')
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ w, i }, n) => (
          <tr key={w.id} tabIndex={0} onClick={() => open(w.id)} onKeyDown={(e) => onRowKey(e, w.id)}>
            <th scope="row" className="c-term">
              <span className="term-cell">
                <span className="rownum">{n + 1}</span>
                <span className="t" lang={lang.code}><Term term={w.term} /></span>
                {w.personal && <MineBadge />}
              </span>
            </th>
            {cols.map((c) => {
              const v = c.cell(w, i, now, tr);
              return (
                <td key={c.key} className={`${c.className ?? ''}${c.num ? ' num' : ''}`} lang={c.lang}>
                  {c.clip ? <span className="clip" title={typeof v === 'string' ? v : undefined}>{v}</span> : v}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Marks your own words (only you see them) among the shared lesson words. */
export function MineBadge() {
  const { t } = useT();
  return <span className="mine" title={t('Your own word: only you see it')}>{t('Mine')}</span>;
}

function Gallery({ rows, now }: { rows: Row[]; now: number }) {
  const ui = useUI();
  const tr = useT();
  const lang = useCourseLang();
  return (
    <div className="gallery">
      {rows.map(({ w, i }) => {
        const due = dueLabel(i, now, tr);
        return (
          <button key={w.id} className="gcard" onClick={() => ui.openSheet({ kind: 'word', id: w.id })}>
            <span className="gcard-top">
              <span>{tr.t(POS_LABEL[w.pos] || '').toLowerCase()}</span>
              <span>{due === '–' ? '' : due}</span>
            </span>
            <span className="gcard-term" lang={lang.code}><Term term={w.term} /></span>
            {w.pronunciation && <span className="gcard-ipa">{w.pronunciation}</span>}
            <span className="gcard-meaning">{w.meaning}</span>
            <span className="gcard-foot">
              <StatusPill info={i} />
              {w.personal && <MineBadge />}
              {(w.tags || []).slice(0, 2).map((t) => <span key={t} className="tag">{t}</span>)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
