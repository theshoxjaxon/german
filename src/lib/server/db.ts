/**
 * Database connection and schema (SQLite through libSQL).
 *
 * - Locally the database is a file: data/karteikasten.db (no setup needed).
 * - In production set DATABASE_URL (and DATABASE_AUTH_TOKEN) to a Turso database,
 *   or keep the file on a server with a persistent disk.
 *
 * The client lives on globalThis because Next.js may load this module more than once
 * (one copy per route bundle, plus hot reloads in dev); one connection per process is enough.
 */
import { createClient, type Client, type InStatement } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { seedWords } from '../seed';

const g = globalThis as typeof globalThis & { __kkDb?: { client: Client; ready: Promise<void> } };

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, 'karteikasten.db')}`;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    created_at    INTEGER NOT NULL,
    last_seen_at  INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,          -- SHA-256 of the cookie token; the token itself is never stored
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS words (
    id         TEXT PRIMARY KEY,
    data       TEXT NOT NULL,             -- JSON WordData
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    user_id    TEXT NOT NULL,
    word_id    TEXT NOT NULL,
    data       TEXT NOT NULL,             -- JSON CardDoc: this person's progress on one word
    started    INTEGER NOT NULL DEFAULT 0,
    mature     INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, word_id)
  )`,
  `CREATE TABLE IF NOT EXISTS prefs (
    user_id TEXT PRIMARY KEY,
    data    TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS activity (
    user_id   TEXT NOT NULL,
    day       TEXT NOT NULL,              -- 'YYYY-MM-DD' in APP_TIMEZONE
    answers   INTEGER NOT NULL DEFAULT 0,
    new_cards INTEGER NOT NULL DEFAULT 0,
    visits    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  )`,
  `CREATE INDEX IF NOT EXISTS activity_day ON activity (day)`,
  `CREATE TABLE IF NOT EXISTS cheers (
    id         TEXT PRIMARY KEY,
    from_user  TEXT NOT NULL,
    to_user    TEXT NOT NULL,
    kind       TEXT NOT NULL,
    day        TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    seen_at    INTEGER,
    UNIQUE (from_user, to_user, day)      -- one cheer per classmate per day
  )`,
  `CREATE INDEX IF NOT EXISTS cheers_to ON cheers (to_user, seen_at)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

/** Six characters without look-alikes (no 0/O, 1/I/L), e.g. "K7M2QX". */
export function newJoinCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

async function migrate(client: Client): Promise<void> {
  if (databaseUrl().startsWith('file:')) {
    // Better concurrency for a local file: readers don't block the writer.
    await client.execute('PRAGMA journal_mode = WAL').catch(() => {});
    await client.execute('PRAGMA busy_timeout = 5000').catch(() => {});
  }
  await client.batch(SCHEMA, 'write');

  // First start: load the Lektion 3 words (only once, so deleting them all doesn't bring them back).
  const seeded = await client.execute(`SELECT value FROM settings WHERE key = 'seeded'`);
  if (!seeded.rows.length) {
    const now = Date.now();
    const stmts: InStatement[] = Object.values(seedWords(now)).map(({ id, ...data }) => ({
      sql: 'INSERT OR IGNORE INTO words (id, data, updated_at) VALUES (?, ?, ?)',
      args: [id, JSON.stringify(data), now],
    }));
    stmts.push({ sql: `INSERT INTO settings (key, value) VALUES ('seeded', '1')`, args: [] });
    await client.batch(stmts, 'write');
  }

  // The code students need to create a profile. JOIN_CODE sets the first one; the admin can change it later.
  const initialCode = process.env.JOIN_CODE?.trim().toUpperCase() || newJoinCode();
  await client.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('join_code', ?)`, args: [initialCode] });
  const code = await client.execute(`SELECT value FROM settings WHERE key = 'join_code'`);
  const users = await client.execute('SELECT count(*) AS n FROM users');
  if (Number(users.rows[0].n) === 0) {
    console.log(`\n  Karteikasten: no profiles yet. Sign up with join code ${code.rows[0].value} — the first profile becomes the admin.\n`);
  }
}

export async function getDb(): Promise<Client> {
  if (!g.__kkDb) {
    const client = createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
    const ready = migrate(client);
    g.__kkDb = { client, ready };
    ready.catch(() => {
      g.__kkDb = undefined; // let the next request retry
    });
  }
  await g.__kkDb.ready;
  return g.__kkDb.client;
}
