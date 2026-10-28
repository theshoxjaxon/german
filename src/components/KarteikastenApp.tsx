'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tick, useLocalState } from '@/lib/client/hooks';
import { useT } from '@/lib/client/i18n';
import { store, useStore } from '@/lib/client/store';
import { buildQueue, pickNext, type QueueItem } from '@/lib/queue';
import { EMPTY_FILTERS, SORTS, type Sort } from '@/lib/words-view';
import { AccountSheet, CheerSheet } from './AccountSheets';
import { AiSheet } from './AiSheet';
import { BrandMark } from './auth/AuthShell';
import { ClassView } from './ClassView';
import { GuestActions, LockedView } from './GuestViews';
import { ReviewSession } from './ReviewSession';
import { SettingsSheet } from './SettingsSheet';
import { StatsView } from './StatsView';
import { StudyView } from './StudyView';
import { Avatar, Icon, type IconName } from './ui';
import { UIContext, type Layout, type SheetSpec, type Tab, type UI, type WordsQuery } from './ui-context';
import { CsvSheet, FieldsSheet, FilterSheet, MoreSheet, SortSheet } from './WordsSheets';
import { ImportSheet } from './ImportSheet';
import { DEFAULT_FIELDS, WordsView, isFieldList } from './WordsView';
import { WordSheet } from './WordSheet';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'study', label: 'Study', icon: 'cards' },
  { id: 'words', label: 'Words', icon: 'table' },
  { id: 'class', label: 'Class', icon: 'people' },
  { id: 'stats', label: 'Progress', icon: 'chart' },
];
const DEFAULT_SORT: Sort = { key: 'source', dir: 'asc' };
const isTab = (v: unknown) => v === 'study' || v === 'words' || v === 'class' || v === 'stats';
const isLayout = (v: unknown) => v === 'table' || v === 'gallery';
const isSort = (v: unknown) =>
  !!v && typeof v === 'object' && (v as Sort).key in SORTS && ((v as Sort).dir === 'asc' || (v as Sort).dir === 'desc');

export default function KarteikastenApp() {
  const { me, guest } = useStore();
  const { t, lang } = useT();
  const [tab, setTab] = useLocalState<Tab>('kk.tab', 'study', isTab);
  const [layout, setLayout] = useLocalState<Layout>('kk.layout', 'table', isLayout);
  const [sort, setSort] = useLocalState<Sort>('kk.sort', DEFAULT_SORT, isSort);
  const [fields, setFields] = useLocalState<string[]>('kk.fields', DEFAULT_FIELDS, isFieldList);
  const [query, setQueryState] = useState<WordsQuery>({ q: '', filters: EMPTY_FILTERS });
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [review, setReview] = useState<{ first: QueueItem | null; startedAt: number } | null>(null);
  const [toastState, setToastState] = useState<{ message: string; visible: boolean; id: number }>({ message: '', visible: false, id: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const toast = useCallback((message: string) => setToastState((t) => ({ message, visible: true, id: t.id + 1 })), []);
  useEffect(() => {
    if (!toastState.visible) return;
    const t = setTimeout(() => setToastState((s) => ({ ...s, visible: false })), 3000);
    return () => clearTimeout(t);
  }, [toastState.visible, toastState.id]);

  const openSheet = useCallback((spec: SheetSpec) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    setSheetClosing(false);
    setSheet(spec);
  }, []);
  const closeSheet = useCallback(() => {
    setSheetClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    closeTimer.current = setTimeout(() => {
      setSheet(null);
      setSheetClosing(false);
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      opener.current = null;
    }, reduce ? 0 : 200);
  }, []);

  const startReview = useCallback(() => {
    const now = Date.now();
    setReview({ first: pickNext(buildQueue(store.getSnapshot(), now), now), startedAt: now });
  }, []);
  const endReview = useCallback(() => {
    setReview(null);
    tick();
  }, []);

  // Load data, show save errors as toasts, and refresh when the app comes back to the foreground
  // (so progress made on your phone shows up on your laptop and the other way round).
  useEffect(() => {
    store.setErrorHandler(toast);
    store.load();
    const refresh = () => {
      if (document.hidden) return;
      tick();
      store.load();
      if (store.getSnapshot().classData) store.loadClass();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [toast]);

  // Screen readers and the browser's spell checking follow the interface language.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Escape closes the open sheet; "/" jumps to the word search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      if (e.key === 'Escape' && sheet && !sheetClosing) {
        e.preventDefault();
        closeSheet();
      } else if (e.key === '/' && !typing && !sheet && !review && tab === 'words') {
        e.preventDefault();
        document.getElementById('w-search')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, sheetClosing, closeSheet, review, tab]);

  const ui: UI = useMemo(
    () => ({
      tab, setTab, openSheet, closeSheet, sheetClosing, toast, startReview,
      query, setQuery: (update) => setQueryState(update),
      layout, setLayout, sort, setSort, fields, setFields,
    }),
    [tab, setTab, openSheet, closeSheet, sheetClosing, toast, startReview, query, layout, setLayout, sort, setSort, fields, setFields],
  );

  return (
    <UIContext.Provider value={ui}>
      <div className="app">
        <header className="appbar">
          <span className="appbar-brand">
            <BrandMark size={26} />
            <span className="appbar-word">Karteikasten</span>
          </span>
          {me && (
            <button className="appbar-user" onClick={() => openSheet({ kind: 'account' })} aria-label={t('Your profile, {name}', { name: me.displayName })}>
              <span className="appbar-name">{me.displayName.split(' ')[0]}</span>
              <Avatar id={me.id} name={me.displayName} src={me.avatarUrl} size="sm" />
            </button>
          )}
          {guest && <GuestActions />}
        </header>
        <main className="views">
          <section className="view" aria-label={t('Study')} hidden={tab !== 'study'}>
            <StudyView />
          </section>
          {/* Guests practise the flashcards and browse the words (read-only); Class and Progress come with a free profile. */}
          <section className="view view-words" aria-label={t('Words')} hidden={tab !== 'words'}>
            <WordsView />
          </section>
          <section className="view" aria-label={t('Class')} hidden={tab !== 'class'}>
            {guest ? <LockedView feature="class" /> : <ClassView active={tab === 'class'} />}
          </section>
          <section className="view" aria-label={t('Progress')} hidden={tab !== 'stats'}>
            {guest ? <LockedView feature="stats" /> : <StatsView />}
          </section>
        </main>
        <nav className="tabbar" aria-label={t('Sections')}>
          {TABS.map((tb) => {
            const locked = guest && (tb.id === 'class' || tb.id === 'stats');
            return (
              <button key={tb.id} className="tab" aria-current={tab === tb.id ? 'page' : 'false'} onClick={() => setTab(tb.id)}
                aria-label={locked ? t('{label} (needs a profile)', { label: t(tb.label) }) : undefined}>
                <span className="tab-ic">
                  <Icon name={tb.icon} />
                  {locked && <span className="tab-lock"><Icon name="lock" /></span>}
                </span>
                {t(tb.label)}
              </button>
            );
          })}
        </nav>
      </div>

      {review && <ReviewSession first={review.first} startedAt={review.startedAt} onClose={endReview} />}
      {sheet && <SheetHost spec={sheet} />}
      <div className={`toast${toastState.visible ? ' show' : ''}`} role="status" aria-live="polite">
        {t(toastState.message)}
      </div>
    </UIContext.Provider>
  );
}

function SheetHost({ spec }: { spec: SheetSpec }) {
  switch (spec.kind) {
    case 'word':
      return <WordSheet key={spec.id ?? 'new'} id={spec.id} />;
    case 'import':
      return <ImportSheet />;
    case 'ai':
      return <AiSheet />;
    case 'filter':
      return <FilterSheet />;
    case 'sort':
      return <SortSheet />;
    case 'fields':
      return <FieldsSheet />;
    case 'more':
      return <MoreSheet />;
    case 'settings':
      return <SettingsSheet />;
    case 'csv':
      return <CsvSheet text={spec.text} />;
    case 'account':
      return <AccountSheet />;
    case 'cheer':
      return <CheerSheet to={spec.to} />;
  }
}
