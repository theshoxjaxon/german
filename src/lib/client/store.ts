/**
 * Client-side data store.
 *
 * Components read it through useStore() (React's useSyncExternalStore), so every
 * component sees the same snapshot and re-renders when it changes.
 *
 * Writes are optimistic: the snapshot changes immediately, the request goes out in the
 * background, and on failure the change is rolled back. Writes to the same document are
 * chained, so two quick answers on one card can never reach the server out of order.
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_PREFS, type AppData, type CardDoc, type Prefs, type Word } from '../types';

export interface Snapshot {
  status: 'loading' | 'ready' | 'error';
  words: Map<string, Word>;
  cards: Map<string, CardDoc>;
  prefs: Prefs;
}
type Kind = 'words' | 'cards';
type Doc<K extends Kind> = K extends 'words' ? Word : CardDoc;

const INITIAL: Snapshot = { status: 'loading', words: new Map(), cards: new Map(), prefs: DEFAULT_PREFS };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function send(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init.method} ${url} failed with ${res.status}`);
}

class Store {
  private snap: Snapshot = INITIAL;
  private listeners = new Set<() => void>();
  private pending = { words: new Map<string, number>(), cards: new Map<string, number>() }; // id → write sequence
  private chains = new Map<string, Promise<unknown>>();
  private seq = 0;
  private loading: Promise<void> | null = null;
  private prefsTimer: ReturnType<typeof setTimeout> | null = null;
  private prefsDirty = false;
  private onError: (message: string) => void = () => {};

  /** The app passes its toast function here so failed saves are reported. */
  setErrorHandler(fn: (message: string) => void) {
    this.onError = fn;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snap;
  getServerSnapshot = () => INITIAL;

  private emit(next: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...next };
    this.listeners.forEach((fn) => fn());
  }

  /** Fetch everything from the server. Also used to pick up changes made on another device. */
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (!res.ok) throw new Error(`GET /api/state failed with ${res.status}`);
        const data = (await res.json()) as AppData;
        const words = new Map(Object.entries(data.words));
        const cards = new Map(Object.entries(data.cards));
        // Keep local changes that the server has not confirmed yet.
        for (const id of this.pending.words.keys()) this.keepLocal(words, this.snap.words, id);
        for (const id of this.pending.cards.keys()) this.keepLocal(cards, this.snap.cards, id);
        this.emit({ status: 'ready', words, cards, prefs: this.prefsDirty ? this.snap.prefs : { ...DEFAULT_PREFS, ...data.prefs } });
      } catch {
        if (this.snap.status === 'loading') this.emit({ status: 'error' });
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  private keepLocal<T>(fresh: Map<string, T>, current: Map<string, T>, id: string) {
    const local = current.get(id);
    if (local === undefined) fresh.delete(id);
    else fresh.set(id, local);
  }

  private chain(key: string, op: () => Promise<void>): Promise<void> {
    const run = (this.chains.get(key) || Promise.resolve()).then(op);
    this.chains.set(key, run.catch(() => {}));
    return run;
  }

  private async write<K extends Kind>(kind: K, id: string, doc: Doc<K> | null): Promise<boolean> {
    const prev = this.snap[kind].get(id) as Doc<K> | undefined;
    const seq = ++this.seq;
    this.pending[kind].set(id, seq);
    const next = new Map(this.snap[kind] as Map<string, Doc<K>>);
    if (doc) next.set(id, doc);
    else next.delete(id);
    this.emit({ [kind]: next } as Partial<Snapshot>);

    const url = `/api/${kind}/${encodeURIComponent(id)}`;
    try {
      await this.chain(`${kind}/${id}`, () =>
        send(url, doc ? { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(doc) } : { method: 'DELETE' }),
      );
      return true;
    } catch {
      if (this.pending[kind].get(id) === seq) {
        const rolled = new Map(this.snap[kind] as Map<string, Doc<K>>);
        if (prev === undefined) rolled.delete(id);
        else rolled.set(id, prev);
        this.emit({ [kind]: rolled } as Partial<Snapshot>);
      }
      this.onError('Could not save. Check that the app is still running, then try again.');
      return false;
    } finally {
      if (this.pending[kind].get(id) === seq) this.pending[kind].delete(id);
    }
  }

  saveWord = (word: Word) => this.write('words', word.id, word);
  saveCard = (id: string, doc: CardDoc | null) => this.write('cards', id, doc);

  /** Pause or resume a word. Paused words never appear in study sessions. */
  setSuspended(id: string, suspended: boolean) {
    const doc = this.snap.cards.get(id);
    return this.write('cards', id, { f: doc?.f ?? null, r: doc?.r ?? null, suspended, updatedAt: Date.now() });
  }

  async deleteWord(id: string): Promise<boolean> {
    const hadCard = this.snap.cards.has(id);
    const ok = await this.write('words', id, null);
    if (ok && hadCard) {
      // The server already removed the progress; mirror that locally.
      const cards = new Map(this.snap.cards);
      cards.delete(id);
      this.emit({ cards });
    }
    return ok;
  }

  /** Add many words in one request (Import). */
  async addWords(list: Word[]): Promise<boolean> {
    const before = this.snap.words;
    const words = new Map(before);
    for (const w of list) words.set(w.id, w);
    this.emit({ words });
    try {
      await send('/api/words', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ words: list }) });
      return true;
    } catch {
      const rolled = new Map(this.snap.words);
      for (const w of list) if (!before.has(w.id)) rolled.delete(w.id);
      this.emit({ words: rolled });
      this.onError('Could not import the list. Check that the app is still running, then try again.');
      return false;
    }
  }

  async resetAllProgress(): Promise<boolean> {
    const before = this.snap.cards;
    this.emit({ cards: new Map() });
    try {
      await send('/api/cards', { method: 'DELETE' });
      return true;
    } catch {
      this.emit({ cards: before });
      this.onError('Could not reset progress. Try again.');
      return false;
    }
  }

  /** Settings change instantly and save after a short pause, so tapping + five times sends one request. */
  setPrefs(patch: Partial<Prefs>, immediate = false) {
    this.emit({ prefs: { ...this.snap.prefs, ...patch } });
    this.prefsDirty = true;
    if (this.prefsTimer) clearTimeout(this.prefsTimer);
    this.prefsTimer = setTimeout(async () => {
      try {
        await send('/api/prefs', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(this.snap.prefs) });
      } catch {
        this.onError('Could not save your settings.');
      } finally {
        this.prefsDirty = false;
      }
    }, immediate ? 0 : 450);
  }
}

export const store = new Store();

export function useStore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
