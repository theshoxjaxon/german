'use client';

import { createContext, useContext } from 'react';
import type { Filters, Sort } from '@/lib/words-view';

export type Tab = 'study' | 'words' | 'class' | 'stats';
export type Layout = 'table' | 'gallery';

/** Which bottom sheet is open. Only one at a time. */
export type SheetSpec =
  | { kind: 'word'; id: string | null }
  | { kind: 'import' }
  | { kind: 'filter' }
  | { kind: 'sort' }
  | { kind: 'fields' }
  | { kind: 'more' }
  | { kind: 'settings' }
  | { kind: 'csv'; text: string }
  | { kind: 'account' }
  | { kind: 'password' }
  | { kind: 'cheer'; to: string };

export interface WordsQuery {
  q: string;
  filters: Filters;
}

export interface UI {
  tab: Tab;
  setTab: (t: Tab) => void;
  openSheet: (s: SheetSpec) => void;
  closeSheet: () => void;
  sheetClosing: boolean;
  toast: (message: string) => void;
  startReview: () => void;
  // Words tab view state
  query: WordsQuery;
  setQuery: (update: (q: WordsQuery) => WordsQuery) => void;
  layout: Layout;
  setLayout: (l: Layout) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
  fields: string[];
  setFields: (f: string[]) => void;
}

export const UIContext = createContext<UI | null>(null);

export function useUI(): UI {
  const ui = useContext(UIContext);
  if (!ui) throw new Error('useUI must be used inside <KarteikastenApp>');
  return ui;
}
