/**
 * Client-side data store.
 *
 * Components read it through useStore() (React's useSyncExternalStore), so every
 * component sees the same snapshot and re-renders when it changes.
 *
 * Writes are optimistic: the snapshot changes immediately, the request goes out in the
 * background, and on failure the change is rolled back. Writes to the same document are
 * chained, so two quick answers on one card can never reach the server out of order.
 *
 * Guests (no profile yet) can practise the flashcards too. Their progress and settings are
 * kept in this browser's localStorage; after they sign up it is moved into their profile.
 */
import { useSyncExternalStore } from 'react';
import type { ServerStreak } from '../goal';
import { translateCount } from '../i18n';
import { deviceLang, rememberLang } from './lang-device';
import { noteTry, noteVisit } from './visitor';
import { DEFAULT_PREFS, type AppData, type CardDoc, type Cheer, type CheerKind, type ClassData, type GuestData, type Me, type Prefs, type Word } from '../types';

export interface Snapshot {
  status: 'loading' | 'ready' | 'error';
  loadProblem: 'offline' | 'server' | null; // why status is 'error'
  me: Me | null;
  guest: boolean; // studying without a profile; progress lives in this browser only
  guestWords: number; // signed in, with guest progress on this device waiting for a decision
  ai: boolean;
  streak: ServerStreak | null; // signed in: from the server (guests count on the device) // the AI word helper is available
  words: Map<string, Word>;
  cards: Map<string, CardDoc>;
  prefs: Prefs;
  cheers: Cheer[]; // received, not yet seen
  classData: ClassData | null;
  classStatus: 'idle' | 'loading' | 'ready' | 'error';
}
type Kind = 'words' | 'cards';
type Doc<K extends Kind> = K extends 'words' ? Word : CardDoc;

const INITIAL: Snapshot = {
  status: 'loading', loadProblem: null, me: null, guest: false, guestWords: 0, ai: false, streak: null, words: new Map(), cards: new Map(), prefs: DEFAULT_PREFS,
  cheers: [], classData: null, classStatus: 'idle',
};
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/* ---------- guest progress, kept in this browser ---------- */
const GUEST_CARDS = 'kk.guest.cards';
const GUEST_PREFS = 'kk.guest.prefs';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readGuest(key: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return isObj(v) ? v : {};
  } catch {
    return {}; // storage blocked or bad JSON
  }
}
function readGuestCards(): Record<string, CardDoc> {
  const out: Record<string, CardDoc> = {};
  for (const [id, doc] of Object.entries(readGuest(GUEST_CARDS))) {
    if (isObj(doc) && typeof doc.suspended === 'boolean') out[id] = doc as unknown as CardDoc;
  }
  return out;
}
/** Returns false when the browser refuses to store (private mode, storage full). */
function writeGuest(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function clearGuest() {
  try {
    localStorage.removeItem(GUEST_CARDS);
    localStorage.removeItem(GUEST_PREFS);
  } catch {
    /* ignore */
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** The session ended (expired, or signed out on another device): go to the login page. */
function toLogin() {
  // A full page load on purpose: it drops every bit of the old user's data held in memory.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/login');
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    toLogin();
    throw new HttpError(401, 'Signed out');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new HttpError(res.status, body?.error || `Request failed (${res.status})`);
  }
  return res;
}

/** The server explains refusals (not your word, too many words…); network trouble gets the fallback. */
const saveError = (e: unknown, fallback: string) =>
  e instanceof HttpError && (e.status === 400 || e.status === 403) ? e.message : e instanceof HttpError && e.status === 401 ? '' : fallback;

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
  private report(message: string) {
    if (message) this.onError(message);
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

  /** Fetch your data from the server. Also used to pick up changes made on another device. */
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        if (await this.fetchState()) await this.checkGuestProgress();
      } catch (e) {
        if (this.snap.status === 'loading' && !(e instanceof HttpError && e.status === 401)) {
          this.emit({ status: 'error', loadProblem: e instanceof HttpError ? 'server' : 'offline' });
        }
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /** Load the signed-in person's data, or the guest view. Resolves true when signed in. */
  private async fetchState(): Promise<boolean> {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) throw new HttpError(res.status, `Request failed (${res.status})`);
    const data = (await res.json()) as AppData | GuestData;
    const words = new Map(Object.entries(data.words));
    if (!data.me) {
      // Signed in a moment ago but not any more (expired, or signed out on another device).
      if (this.snap.me) {
        toLogin();
        throw new HttpError(401, 'Signed out');
      }
      // A guest: progress and settings come from this browser.
      this.emit({
        status: 'ready', me: null, guest: true, guestWords: 0, ai: false, streak: null, words, cheers: [],
        cards: new Map(Object.entries(readGuestCards())),
        prefs: { ...DEFAULT_PREFS, ...readGuest(GUEST_PREFS) } as Prefs,
      });
      noteVisit(); // anonymous count for the analytics funnel
      return false;
    }
    const cards = new Map(Object.entries(data.cards));
    // Keep local changes that the server has not confirmed yet.
    for (const id of this.pending.words.keys()) this.keepLocal(words, this.snap.words, id);
    for (const id of this.pending.cards.keys()) this.keepLocal(cards, this.snap.cards, id);
    this.emit({
      status: 'ready',
      me: data.me,
      guest: false,
      ai: data.ai === true,
      streak: data.streak ?? null,
      words,
      cards,
      cheers: data.cheers,
      prefs: this.prefsDirty ? this.snap.prefs : { ...DEFAULT_PREFS, ...data.prefs },
    });
    if (data.prefs.uiLang) rememberLang(data.prefs.uiLang);
    return true;
  }

  /**
   * After signing in: did this person study as a guest on this device first? A profile with
   * no progress yet (just created) takes it over right away; otherwise we ask first, because
   * on a shared computer that guest may have been someone else.
   */
  private async checkGuestProgress() {
    const n = Object.keys(readGuestCards()).length;
    const prefs = Object.keys(readGuest(GUEST_PREFS)).length > 0;
    if ((n || prefs) && this.snap.cards.size === 0) await this.importGuestProgress(false);
    else if (!n && prefs) clearGuest(); // only settings, and the profile has its own: keep the profile's
    else if (n !== this.snap.guestWords) this.emit({ guestWords: n });
  }

  /** Move guest progress from this browser into the profile. Words already studied keep the profile's progress. */
  async importGuestProgress(asked = true): Promise<boolean> {
    const cards = readGuestCards();
    const prefs = readGuest(GUEST_PREFS);
    try {
      const res = await send('/api/cards/import', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ cards, prefs: Object.keys(prefs).length ? prefs : undefined }),
      });
      const { imported } = (await res.json()) as { imported: number };
      clearGuest();
      this.emit({ guestWords: 0 });
      await this.fetchState().catch(() => {}); // saved either way; the next refresh shows it
      if (imported) {
        const lang = this.snap.prefs.uiLang ?? deviceLang();
        this.report(translateCount(lang, imported, 'Your guest progress ({n} word) is now saved in your profile.', 'Your guest progress ({n} words) is now saved in your profile.'));
      }
      else if (asked) this.report('Your profile already had progress on those words, so it stays as it was.');
      return true;
    } catch (e) {
      this.report(saveError(e, 'Could not add your guest progress. Try again.'));
      return false;
    }
  }

  /** Throw away guest progress left on this device. */
  discardGuestProgress() {
    clearGuest();
    this.emit({ guestWords: 0 });
  }

  /** Guests: save all progress to this browser. */
  private saveGuestCards(cards: Map<string, CardDoc>) {
    if (!writeGuest(GUEST_CARDS, Object.fromEntries(cards))) {
      this.report('This browser won’t save progress (private mode?). Create a free profile to keep it.');
    }
  }

  private keepLocal<T>(fresh: Map<string, T>, current: Map<string, T>, id: string) {
    const local = current.get(id);
    if (local === undefined) fresh.delete(id);
    else fresh.set(id, local);
  }

  private chain(key: string, op: () => Promise<unknown>): Promise<unknown> {
    const run = (this.chains.get(key) || Promise.resolve()).then(op);
    this.chains.set(key, run.catch(() => {}));
    return run;
  }

  private async write<K extends Kind>(kind: K, id: string, doc: Doc<K> | null): Promise<boolean> {
    if (this.snap.guest) {
      if (kind === 'words') {
        this.report('Create a free profile to edit words.');
        return false;
      }
      const cards = new Map(this.snap.cards);
      if (doc) cards.set(id, doc as CardDoc);
      else cards.delete(id);
      this.emit({ cards });
      this.saveGuestCards(cards);
      const card = doc as CardDoc | null;
      if (card?.f?.log.length || card?.r?.log.length) noteTry(); // a guest answered a card
      return true;
    }
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
    } catch (e) {
      if (this.pending[kind].get(id) === seq) {
        const rolled = new Map(this.snap[kind] as Map<string, Doc<K>>);
        if (prev === undefined) rolled.delete(id);
        else rolled.set(id, prev);
        this.emit({ [kind]: rolled } as Partial<Snapshot>);
      }
      this.report(saveError(e, 'Could not save. Check your internet connection, then try again.'));
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
    } catch (e) {
      const rolled = new Map(this.snap.words);
      for (const w of list) if (!before.has(w.id)) rolled.delete(w.id);
      this.emit({ words: rolled });
      this.report(saveError(e, 'Could not import the list. Check your internet connection, then try again.'));
      return false;
    }
  }

  async resetAllProgress(): Promise<boolean> {
    const before = this.snap.cards;
    this.emit({ cards: new Map() });
    if (this.snap.guest) {
      this.saveGuestCards(new Map());
      return true;
    }
    try {
      await send('/api/cards', { method: 'DELETE' });
      return true;
    } catch (e) {
      this.emit({ cards: before });
      this.report(saveError(e, 'Could not reset progress. Try again.'));
      return false;
    }
  }

  /** Settings change instantly and save after a short pause, so tapping + five times sends one request. */
  setPrefs(patch: Partial<Prefs>, immediate = false) {
    this.emit({ prefs: { ...this.snap.prefs, ...patch } });
    if (patch.uiLang) rememberLang(patch.uiLang); // so the login page speaks it too
    if (this.snap.guest) {
      writeGuest(GUEST_PREFS, this.snap.prefs);
      return;
    }
    this.prefsDirty = true;
    if (this.prefsTimer) clearTimeout(this.prefsTimer);
    this.prefsTimer = setTimeout(async () => {
      try {
        await send('/api/prefs', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(this.snap.prefs) });
      } catch (e) {
        this.report(saveError(e, 'Could not save your settings.'));
      } finally {
        this.prefsDirty = false;
      }
    }, immediate ? 0 : 450);
  }

  /* ---------- class (social) ---------- */

  async loadClass(): Promise<void> {
    if (this.snap.classStatus === 'loading') return;
    this.emit({ classStatus: this.snap.classData ? 'ready' : 'loading' });
    try {
      const res = await send('/api/class', { cache: 'no-store' });
      this.emit({ classData: (await res.json()) as ClassData, classStatus: 'ready' });
    } catch {
      this.emit({ classStatus: this.snap.classData ? 'ready' : 'error' });
    }
  }

  /** A self-learner adds the class code. Resolves to an error message, or null when it worked. */
  async joinClass(code: string): Promise<string | null> {
    try {
      await send('/api/class/join', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ code }) });
    } catch (e) {
      return saveError(e, 'Could not join. Check your internet connection and try again.') || 'Could not join.';
    }
    if (this.snap.me) this.emit({ me: { ...this.snap.me, inClass: true } });
    void this.load(); // class members also get the AI helper
    void this.loadClass();
    return null;
  }

  /** Send a classmate a cheer. Shows as sent right away. */
  async sendCheer(to: string, kind: CheerKind): Promise<boolean> {
    const before = this.snap.classData;
    const mark = (cheered: boolean) =>
      before && { ...before, members: before.members.map((m) => (m.id === to ? { ...m, cheeredToday: cheered } : m)) };
    this.emit({ classData: mark(true) });
    try {
      await send('/api/cheers', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ to, kind }) });
      return true;
    } catch (e) {
      this.emit({ classData: mark(false) });
      this.report(saveError(e, 'Could not send your cheer. Try again.'));
      return false;
    }
  }

  /** Clear the cheers you received (after you have seen them). */
  async dismissCheers(): Promise<void> {
    if (!this.snap.cheers.length) return;
    this.emit({ cheers: [] });
    await send('/api/cheers/seen', { method: 'POST' }).catch(() => {});
  }
}

export const store = new Store();

export function useStore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
