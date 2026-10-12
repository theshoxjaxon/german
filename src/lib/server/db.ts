/**
 * A small JSON-file database: data/store.json (or $DATA_DIR/store.json).
 *
 * - Reads come straight from disk, so the file is the single source of truth.
 * - Writes go through one queue: read → change → write a temp file → rename.
 *   The rename is atomic, so a crash never leaves a half-written file.
 * - The queue lives on globalThis because Next.js can load this module more than once
 *   (one copy per route bundle, plus hot reloads in dev). One queue per process keeps
 *   two requests from overwriting each other's changes.
 *
 * Good for one person running the app on their own machine. For many users, swap this
 * file for a real database; the route handlers only use readData() and mutate().
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { seedWords } from '../seed';
import { DEFAULT_PREFS, type AppData } from '../types';
import { sanitizeCard, sanitizePrefs, sanitizeWord } from './validate';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'store.json');

const g = globalThis as typeof globalThis & { __karteikastenQueue?: Promise<unknown> };

function normalize(raw: unknown): AppData {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof AppData, Record<string, unknown>>>;
  const data: AppData = { words: {}, cards: {}, prefs: sanitizePrefs(src.prefs, DEFAULT_PREFS) };
  for (const [id, w] of Object.entries(src.words || {})) {
    const clean = sanitizeWord(w);
    if (clean) data.words[id] = { ...clean, id };
  }
  for (const [id, c] of Object.entries(src.cards || {})) {
    const clean = sanitizeCard(c);
    if (clean) data.cards[id] = clean;
  }
  return data;
}

async function writeFile(data: AppData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, FILE);
}

async function load(): Promise<AppData> {
  try {
    return normalize(JSON.parse(await fs.readFile(FILE, 'utf8')));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    // First run: start with the Lektion 3 words.
    const data: AppData = { words: seedWords(), cards: {}, prefs: { ...DEFAULT_PREFS } };
    await writeFile(data);
    return data;
  }
}

/** Run `fn` on the current data and save the result. Calls run one at a time. */
export function mutate<T>(fn: (data: AppData) => T): Promise<T> {
  const run = (g.__karteikastenQueue || Promise.resolve()).then(async () => {
    const data = await load();
    const result = fn(data);
    await writeFile(data);
    return result;
  });
  g.__karteikastenQueue = run.catch(() => {});
  return run;
}

/** Read the data after any queued writes have finished. */
export async function readData(): Promise<AppData> {
  await g.__karteikastenQueue;
  return load();
}
